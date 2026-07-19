@echo off
setlocal

set PATH=C:\Qt\6.8.0\mingw_64\bin;C:\Qt\Tools\mingw1310_64\bin;C:\Program Files\CMake\bin;%PATH%

cd /d "%~dp0"

set BUILD_DIR=build_release
set INSTALL_DIR=%BUILD_DIR%\install
set OUTPUT_DIR=%BUILD_DIR%\output

if exist %BUILD_DIR% rmdir /s /q %BUILD_DIR%

mkdir %BUILD_DIR%
cd %BUILD_DIR%

echo === Step 1: CMake Configure ===
cmake .. -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
if %errorlevel% neq 0 (
    echo CMake configuration failed!
    exit /b %errorlevel%
)

echo === Step 2: Build Release ===
mingw32-make -j4
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b %errorlevel%
)

echo === Step 3: Run windeployqt ===
windeployqt --release --no-compiler-runtime --no-translations Memories.exe
if %errorlevel% neq 0 (
    echo windeployqt failed!
    exit /b %errorlevel%
)

echo === Step 4: Copy MinGW Runtime DLLs ===
copy C:\Qt\Tools\mingw1310_64\bin\libgcc_s_seh-1.dll .
copy C:\Qt\Tools\mingw1310_64\bin\libstdc++-6.dll .
copy C:\Qt\Tools\mingw1310_64\bin\libwinpthread-1.dll .

echo === Step 5: Run make install ===
mingw32-make install
if %errorlevel% neq 0 (
    echo Install target failed!
    exit /b %errorlevel%
)

echo === Step 6: Verify install directory ===
echo Contents of install directory:
dir /b %INSTALL_DIR%

echo === Step 7: Generate NSIS Installer ===
cpack -G NSIS -B %OUTPUT_DIR%
if %errorlevel% neq 0 (
    echo CPack failed!
    exit /b %errorlevel%
)

echo === Build Complete ===
echo Installer location:
dir /b %OUTPUT_DIR%\*.exe
echo Full path: %CD%\%OUTPUT_DIR%

endlocal