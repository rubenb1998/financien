#include <windows.h>
#include <shellapi.h>
#include <string.h>
#include <wchar.h>

static BOOL print_url;

static int show_error(const wchar_t *message) {
    if (print_url) {
        char utf8[4096];
        int length = WideCharToMultiByte(CP_UTF8, 0, message, -1, utf8, sizeof(utf8), NULL, NULL);
        DWORD written;
        if (length > 0) WriteFile(GetStdHandle(STD_ERROR_HANDLE), utf8, (DWORD)(length - 1), &written, NULL);
    } else {
        MessageBoxW(NULL, message, L"Financi\u00ebn", MB_OK | MB_ICONERROR);
    }
    return 1;
}

static BOOL find_node(wchar_t *path, DWORD size) {
    DWORD length = SearchPathW(NULL, L"node.exe", NULL, size, path, NULL);
    if (length > 0 && length < size) return TRUE;
    const wchar_t *locations[] = {
        L"%ProgramW6432%\\nodejs\\node.exe",
        L"%ProgramFiles%\\nodejs\\node.exe"
    };
    for (size_t i = 0; i < ARRAYSIZE(locations); i++) {
        length = ExpandEnvironmentStringsW(locations[i], path, size);
        if (length > 0 && length <= size && GetFileAttributesW(path) != INVALID_FILE_ATTRIBUTES) return TRUE;
    }
    return FALSE;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE previous, PWSTR args, int show) {
    (void)instance;
    (void)previous;
    (void)show;
    print_url = wcscmp(args, L"--print-url") == 0;

    wchar_t project[32768], node[32768], command[32768];
    DWORD length = GetModuleFileNameW(NULL, project, ARRAYSIZE(project));
    if (!length || length >= ARRAYSIZE(project))
        return show_error(L"De projectmap kon niet worden gevonden.");
    wchar_t *filename = wcsrchr(project, L'\\');
    if (!filename) return show_error(L"De projectmap kon niet worden gevonden.");
    *filename = L'\0';
    if (!SetCurrentDirectoryW(project) || GetFileAttributesW(L"scripts\\start.mjs") == INVALID_FILE_ATTRIBUTES)
        return show_error(L"Zet Financien.exe terug in de projectmap Financien.");
    if (!find_node(node, ARRAYSIZE(node)))
        return show_error(L"Installeer Node.js 24 of nieuwer om Financi\u00ebn te starten.");
    if (_snwprintf(command, ARRAYSIZE(command), L"\"%ls\" --no-warnings scripts/start.mjs", node) < 0)
        return show_error(L"Het pad naar Node.js is te lang.");

    SECURITY_ATTRIBUTES security = { sizeof(security), NULL, TRUE };
    HANDLE output, child_output;
    if (!CreatePipe(&output, &child_output, &security, 0))
        return show_error(L"De Financi\u00ebn-starter kon niet worden geopend.");
    HANDLE input = CreateFileW(L"NUL", GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE,
                               &security, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    STARTUPINFOW startup = { .cb = sizeof(startup), .dwFlags = STARTF_USESTDHANDLES,
                            .hStdInput = input, .hStdOutput = child_output, .hStdError = child_output };
    PROCESS_INFORMATION process;
    BOOL started = input != INVALID_HANDLE_VALUE && SetHandleInformation(output, HANDLE_FLAG_INHERIT, 0)
        && CreateProcessW(node, command, NULL, NULL, TRUE, CREATE_NO_WINDOW, NULL, project, &startup, &process);
    if (input != INVALID_HANDLE_VALUE) CloseHandle(input);
    CloseHandle(child_output);
    if (!started) {
        CloseHandle(output);
        return show_error(L"Node.js kon niet worden gestart.");
    }
    CloseHandle(process.hThread);

    char result[4096] = {0}, chunk[1024];
    size_t used = 0;
    DWORD bytes;
    while (ReadFile(output, chunk, sizeof(chunk), &bytes, NULL) && bytes) {
        size_t remaining = sizeof(result) - used - 1;
        size_t count = bytes < remaining ? bytes : remaining;
        memcpy(result + used, chunk, count);
        used += count;
    }
    CloseHandle(output);
    WaitForSingleObject(process.hProcess, INFINITE);
    DWORD exit_code = 1;
    GetExitCodeProcess(process.hProcess, &exit_code);
    CloseHandle(process.hProcess);

    if (exit_code == 0) result[strcspn(result, "\r\n")] = '\0';
    wchar_t message[4096];
    if (!MultiByteToWideChar(CP_UTF8, 0, result, -1, message, ARRAYSIZE(message)) || !message[0])
        return show_error(L"Financi\u00ebn kon niet worden gestart. Zie .private/launcher.log in de projectmap.");
    if (exit_code != 0) return show_error(message);
    if (wcsncmp(message, L"http://127.0.0.1:", 17) != 0)
        return show_error(L"De lokale server gaf geen geldig adres terug.");
    if (print_url) {
        DWORD written;
        return WriteFile(GetStdHandle(STD_OUTPUT_HANDLE), result, (DWORD)strlen(result), &written, NULL) ? 0 : 1;
    }
    if ((INT_PTR)ShellExecuteW(NULL, L"open", message, NULL, NULL, SW_SHOWNORMAL) <= 32)
        return show_error(L"De standaardbrowser kon niet worden geopend.");
    return 0;
}
