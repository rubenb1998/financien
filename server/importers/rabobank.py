"""Read Dutch Rabobank PDF exports into source-neutral ledger entries."""
from calendar import isleap
from collections import Counter
from datetime import date, datetime
from hashlib import sha256
import json
from pathlib import Path
import re
import sys

from pypdf import PdfReader

DATE = r"\d{2}-\d{2}-\d{4}"
AMOUNT = r"[+-]?\d[\d.]*,\d{2}"
BANK_ROW = re.compile(r"^\s*(\d{2}-\d{2})\s+([a-z]{2})\s+")
CARD_ROW = re.compile(rf"^\s*({DATE})\s+(.+?)\s{{2,}}({AMOUNT})\s*$")
OWN_ID = re.compile(r"\b(NL\d{2}\s?[A-Z]{4}(?:\s?\d){10})\s+EUR\b")


def cents(amount):
    return int(amount.replace(".", "").replace(",", ""))


def iso(value):
    return datetime.strptime(value, "%d-%m-%Y").date().isoformat()


def period(text, kind):
    if kind == "card":
        match = re.search(rf"Periode\s+({DATE})\s+t/m\s+({DATE})", text)
    else:
        match = re.search(
            rf"Datum vanaf[^\n]*\n\s*({DATE})[^\n]*\n\s*"
            rf"Datum tot en met[^\n]*\n\s*({DATE})",
            text,
        )
    if not match:
        raise ValueError("De afschriftperiode kon niet worden gelezen.")
    return tuple(map(iso, match.groups()))


def expected_totals(text, kind):
    if kind == "card":
        credit = re.search(rf"Totaal\s+({AMOUNT})\s*\n[^\n]*bijgeschreven", text)
        debit = re.search(rf"Totaal afgeschreven\s+({AMOUNT})", text)
        if credit and debit:
            return cents(debit[1]), cents(credit[1])
    else:
        match = re.search(
            rf"Totaal afgeschreven\s+Totaal bijgeschreven\s*\n[^\n]*?\s{{2,}}"
            rf"({AMOUNT})\s+({AMOUNT})",
            text,
        )
        if match:
            return tuple(map(cents, match.groups()))
    raise ValueError("De controletotalen van het afschrift zijn onleesbaar.")


def bank_rows(pages):
    current = None
    for number, page in enumerate(pages, 1):
        lines = page.splitlines()
        header_index = next((i for i, line in enumerate(lines) if "Bedrag af (debet)" in line), None)
        if header_index is None:
            continue
        header = lines[header_index]
        description_start = header.index("Naam/omschrijving")
        credit_start = header.index("Bedrag bij")
        counterparty_start = header.index("Tegenrekening")
        for line in lines[header_index + 1:]:
            match = BANK_ROW.match(line)
            if match:
                if current:
                    yield current
                amount = re.search(rf"(?<!\S)({AMOUNT})\s*$", line)
                if not amount:
                    raise ValueError(f"Een transactie op pagina {number} heeft geen leesbaar bedrag.")
                value = cents(amount[1])
                current = {
                    "shortDate": match[1], "code": match[2], "page": number,
                    "counterparty": re.sub(r"\s+", "", line[counterparty_start:description_start]),
                    "merchant": line[description_start:amount.start()].strip(),
                    "lines": [],
                    "amount": value if amount.end(1) >= credit_start else -value,
                }
            elif current and line.strip() and len(line) - len(line.lstrip()) == description_start:
                current["lines"].append(line.strip())
    if current:
        yield current


def card_rows(pages):
    current = None
    for number, page in enumerate(pages, 1):
        rows_started = False
        for line in page.splitlines():
            match = CARD_ROW.match(line)
            if match:
                if current:
                    yield current
                rows_started = True
                current = {
                    "date": iso(match[1]), "merchant": re.split(r"\s{2,}", match[2], maxsplit=1)[0].strip(),
                    "lines": [match[2].strip()], "code": "card", "amount": cents(match[3]),
                    "counterparty": "", "page": number,
                }
            elif current and rows_started and len(line) - len(line.lstrip()) >= 35:
                if line.strip() and not re.search(r"Pagina\s+\d+/\d+|Operations Betaling", line):
                    current["lines"].append(line.strip())
    if current:
        yield current


def bank_date(row, start, end):
    day, month = map(int, row.pop("shortDate").split("-"))
    matching = re.search(rf"Verwerkingsdatum:\s*({DATE})", " ".join(row["lines"]))
    years = range(int(start[:4]), int(end[:4]) + 1)
    candidates = [date(year, month, day).isoformat() for year in years
                  if day != 29 or month != 2 or isleap(year)]
    candidates = [candidate for candidate in candidates if start <= candidate <= end]
    if matching and candidates:
        processed = date.fromisoformat(iso(matching[1]))
        return min(candidates, key=lambda item: abs((processed - date.fromisoformat(item)).days))
    if len(candidates) == 1:
        return candidates[0]
    raise ValueError("Het jaar van een boeking kon niet eenduidig worden bepaald.")


def read_statement(path):
    reader = PdfReader(path)
    pages = [page.extract_text(extraction_mode="layout") for page in reader.pages]
    first = pages[0]
    kind = "card" if "Details Creditcard" in first else "bank"
    account = OWN_ID.search(first)
    if not account or (kind == "bank" and "Rekeningafschrift" not in first):
        raise ValueError("Kies een Rabobank-rekeningafschrift of Rabobank-creditcardoverzicht als PDF.")
    iban = re.sub(r"\s+", "", account[1])
    start, end = period(first, kind)
    debit, credit = expected_totals(first, kind)
    if kind == "card":
        card_number = re.search(r"Kaartnummer\s+\*+[\s*]+(\d{4})", first)
        if not card_number:
            raise ValueError("Het kaartnummer kon niet worden gelezen.")
        label = f"Creditcard •{card_number[1]}"
    else:
        product = next((line.strip() for line in first.splitlines() if line.strip().startswith("Rabo ")), "Rabobank")
        label = f"{product} •{iban[-4:]}"
    # Rabobank's card PDF includes transactions from replacement cards in the same history.
    account_id = sha256(f"{kind}:{iban}".encode()).hexdigest()[:20]
    entries = list(card_rows(pages) if kind == "card" else bank_rows(pages))
    actual = (
        -sum(row["amount"] for row in entries if row["amount"] < 0),
        sum(row["amount"] for row in entries if row["amount"] > 0),
    )
    if actual != (debit, credit):
        raise ValueError(f"De PDF sluit niet aan op de afschrifttotalen. Gelezen: {len(entries)} regels.")
    occurrences = Counter()
    for index, row in enumerate(entries):
        if kind == "bank":
            row["date"] = bank_date(row, start, end)
        if not row["merchant"] and row["lines"]:
            row["merchant"] = row["lines"][0]
        row["details"] = "\n".join(row.pop("lines"))
        row["ownCounterparty"] = row["counterparty"] == iban
        if re.fullmatch(r"NL\d{2}[A-Z]{4}\d{10}", row["counterparty"]):
            row["counterpartyAccountId"] = sha256(f'bank:{row["counterparty"]}'.encode()).hexdigest()[:20]
        row["order"] = index
        row["accountId"] = account_id
        row["source"] = kind
        # Keep same-day identical card purchases distinct even when the PDF gives no reference.
        identity = [account_id, row["date"], row["amount"], row["code"],
                    row["counterparty"], row["merchant"], re.sub(r"\s+", "", row["details"])]
        fingerprint = sha256(json.dumps(identity).encode()).hexdigest()[:28]
        occurrences[fingerprint] += 1
        row["id"] = f"{fingerprint}-{occurrences[fingerprint]}"
    return {"statement": {
        "id": sha256(Path(path).read_bytes()).hexdigest(), "accountId": account_id, "label": label,
        "source": kind, "from": start, "to": end, "debit": debit, "credit": credit,
        "count": len(entries), "pages": len(pages),
    }, "transactions": entries}


if __name__ == "__main__":
    try:
        print(json.dumps(read_statement(sys.argv[1]), ensure_ascii=False))
    except (ValueError, IndexError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
