# This file will be configured to contain variables for CPack. These variables
# should be set in the CMake list file of the project before CPack module is
# included. The list of available CPACK_xxx variables and their associated
# documentation may be obtained using
#  cpack --help-variable-list
#
# Some variables are common to all generators (e.g. CPACK_PACKAGE_NAME)
# and some are specific to a generator
# (e.g. CPACK_NSIS_EXTRA_INSTALL_COMMANDS). The generator specific variables
# usually begin with CPACK_<GENNAME>_xxxx.


set(CPACK_ARCHIVE_GID "-1")
set(CPACK_ARCHIVE_UID "-1")
set(CPACK_BUILD_SOURCE_DIRS "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows;C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/build_msi")
set(CPACK_CMAKE_GENERATOR "MinGW Makefiles")
set(CPACK_COMPONENT_UNSPECIFIED_HIDDEN "TRUE")
set(CPACK_COMPONENT_UNSPECIFIED_REQUIRED "TRUE")
set(CPACK_DEFAULT_PACKAGE_DESCRIPTION_FILE "C:/Program Files/CMake/share/cmake-4.3/Templates/CPack.GenericDescription.txt")
set(CPACK_DEFAULT_PACKAGE_DESCRIPTION_SUMMARY "Memories built using CMake")
set(CPACK_DMG_SLA_USE_RESOURCE_FILE_LICENSE "ON")
set(CPACK_GENERATOR "7Z;ZIP")
set(CPACK_IGNORE_FILES "/CVS/;/\\.svn/;/\\.bzr/;/\\.hg/;/\\.git/;\\.swp\$;\\.#;/#")
set(CPACK_INNOSETUP_ARCHITECTURE "x64")
set(CPACK_INSTALLED_DIRECTORIES "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows;/")
set(CPACK_INSTALL_CMAKE_PROJECTS "")
set(CPACK_INSTALL_PREFIX "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/build_msi/install")
set(CPACK_MODULE_PATH "C:/Qt/6.8.0/mingw_64/lib/cmake/Qt6;C:/Qt/6.8.0/mingw_64/lib/cmake/Qt6/3rdparty/extra-cmake-modules/find-modules;C:/Qt/6.8.0/mingw_64/lib/cmake/Qt6/3rdparty/kwin")
set(CPACK_NSIS_CREATE_DESKTOP_SHORTCUT "ON")
set(CPACK_NSIS_DISPLAY_NAME "Memories Image Management Client")
set(CPACK_NSIS_DISPLAY_NAME_SET "TRUE")
set(CPACK_NSIS_ENABLE_START_MENU_SHORTCUT "ON")
set(CPACK_NSIS_EXTRA_INSTALL_COMMANDS "
        SetOutPath \"$INSTDIR\"
        CreateShortCut \"$DESKTOP\\Memories.lnk\" \"$INSTDIR\\Memories.exe\" \"\" \"$INSTDIR\\Memories.exe\" 0
        CreateShortCut \"$SMPROGRAMS\\Memories\\Memories.lnk\" \"$INSTDIR\\Memories.exe\" \"\" \"$INSTDIR\\Memories.exe\" 0
    ")
set(CPACK_NSIS_EXTRA_UNINSTALL_COMMANDS "
        Delete \"$DESKTOP\\Memories.lnk\"
        Delete \"$SMPROGRAMS\\Memories\\Memories.lnk\"
    ")
set(CPACK_NSIS_HELP_LINK "https://github.com/idoknow/Memories-Client/issues")
set(CPACK_NSIS_INSTALLED_ICON_NAME "Memories.exe")
set(CPACK_NSIS_INSTALLER_ICON_CODE "")
set(CPACK_NSIS_INSTALLER_MUI_ICON_CODE "")
set(CPACK_NSIS_INSTALL_ROOT "$PROGRAMFILES64")
set(CPACK_NSIS_MODIFY_PATH "ON")
set(CPACK_NSIS_MUI_ICON "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/resources/app-icon.ico")
set(CPACK_NSIS_MUI_UNIICON "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/resources/app-icon.ico")
set(CPACK_NSIS_PACKAGE_NAME "Memories")
set(CPACK_NSIS_UNINSTALL_NAME "Uninstall")
set(CPACK_NSIS_URL_INFO_ABOUT "https://github.com/idoknow/Memories-Client")
set(CPACK_OBJCOPY_EXECUTABLE "C:/Qt/Tools/mingw1310_64/bin/objcopy.exe")
set(CPACK_OBJDUMP_EXECUTABLE "C:/Qt/Tools/mingw1310_64/bin/objdump.exe")
set(CPACK_OUTPUT_CONFIG_FILE "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/build_msi/CPackConfig.cmake")
set(CPACK_PACKAGE_CONTACT "idoknow <i@mrcwoods.com>")
set(CPACK_PACKAGE_DEFAULT_LOCATION "/")
set(CPACK_PACKAGE_DESCRIPTION_FILE "C:/Program Files/CMake/share/cmake-4.3/Templates/CPack.GenericDescription.txt")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "Memories - Image Management Client")
set(CPACK_PACKAGE_FILE_NAME "Memories-1.1.0-Source")
set(CPACK_PACKAGE_INSTALL_DIRECTORY "Memories")
set(CPACK_PACKAGE_INSTALL_REGISTRY_KEY "Memories")
set(CPACK_PACKAGE_NAME "Memories")
set(CPACK_PACKAGE_RELOCATABLE "true")
set(CPACK_PACKAGE_VENDOR "idoknow")
set(CPACK_PACKAGE_VERSION "1.1.0")
set(CPACK_PACKAGE_VERSION_MAJOR "1")
set(CPACK_PACKAGE_VERSION_MINOR "1")
set(CPACK_PACKAGE_VERSION_PATCH "0")
set(CPACK_READELF_EXECUTABLE "C:/Qt/Tools/mingw1310_64/bin/readelf.exe")
set(CPACK_RESOURCE_FILE_LICENSE "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/../LICENSE")
set(CPACK_RESOURCE_FILE_README "C:/Program Files/CMake/share/cmake-4.3/Templates/CPack.GenericDescription.txt")
set(CPACK_RESOURCE_FILE_WELCOME "C:/Program Files/CMake/share/cmake-4.3/Templates/CPack.GenericWelcome.txt")
set(CPACK_RPM_PACKAGE_SOURCES "ON")
set(CPACK_SET_DESTDIR "OFF")
set(CPACK_SOURCE_7Z "ON")
set(CPACK_SOURCE_GENERATOR "7Z;ZIP")
set(CPACK_SOURCE_IGNORE_FILES "/CVS/;/\\.svn/;/\\.bzr/;/\\.hg/;/\\.git/;\\.swp\$;\\.#;/#")
set(CPACK_SOURCE_INSTALLED_DIRECTORIES "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows;/")
set(CPACK_SOURCE_OUTPUT_CONFIG_FILE "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/build_msi/CPackSourceConfig.cmake")
set(CPACK_SOURCE_PACKAGE_FILE_NAME "Memories-1.1.0-Source")
set(CPACK_SOURCE_TOPLEVEL_TAG "win64-Source")
set(CPACK_SOURCE_ZIP "ON")
set(CPACK_STRIP_FILES "")
set(CPACK_SYSTEM_NAME "win64")
set(CPACK_THREADS "1")
set(CPACK_TOPLEVEL_TAG "win64-Source")
set(CPACK_WIX_SIZEOF_VOID_P "8")

if(NOT CPACK_PROPERTIES_FILE)
  set(CPACK_PROPERTIES_FILE "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/build_msi/CPackProperties.cmake")
endif()

if(EXISTS ${CPACK_PROPERTIES_FILE})
  include(${CPACK_PROPERTIES_FILE})
endif()
