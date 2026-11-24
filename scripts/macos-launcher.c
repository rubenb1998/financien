#include <mach-o/dyld.h>
#include <limits.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    char path[PATH_MAX];
    uint32_t size = sizeof(path);
    if (_NSGetExecutablePath(path, &size) != 0) return 1;
    char *filename = strrchr(path, '/');
    if (!filename) return 1;
    size_t available = sizeof(path) - (size_t)(filename + 1 - path);
    if (strlcpy(filename + 1, "../Resources/start.zsh", available) >= available) return 1;
    execl("/bin/zsh", "zsh", path, argc > 1 ? argv[1] : NULL, (char *)NULL);
    return 1;
}
