#pragma once
#include <QMainWindow>
#include <QStackedWidget>
#include <QLabel>
#include <QSystemTrayIcon>
#include <QPoint>
#include <QPushButton>
#include <QMenu>
#include <QAction>
#include "ui/AppleTitleBar.h"

class GalleryWidget;
class ImageViewer;
class UploadDialog;
class SettingsDialog;
class LoginDialog;

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(QWidget* parent = nullptr);
    ~MainWindow();

protected:
    void closeEvent(QCloseEvent* event) override;
    void mousePressEvent(QMouseEvent* event) override;
    void mouseMoveEvent(QMouseEvent* event) override;
    void mouseReleaseEvent(QMouseEvent* event) override;
    void mouseDoubleClickEvent(QMouseEvent* event) override;

private slots:
    void onHealthCheckResult(bool ok);
    void showGallery();
    void showImageViewer(const QString& imageUrl);
    void showUploadDialog();
    void showSettingsDialog();
    void showLoginDialog();
    void onLoginSuccess();
    void updateUserDisplay();

private:
    void setupUi();
    void setupMenuBar(QMenuBar* menuBar);
    void setupToolBar(QToolBar* toolbar);
    void setupStatusBar();
    void setupSystemTray();
    void applyTheme();
    void checkServiceHealth();
    void setupTitleBar();

    QStackedWidget* m_stack;
    GalleryWidget* m_gallery;
    ImageViewer* m_viewer;
    UploadDialog* m_uploadDlg;
    SettingsDialog* m_settingsDlg;
    LoginDialog* m_loginDlg;

    // Custom title bar
    AppleTitleBar* m_titleBar;

    // Account menu
    QMenu* m_accountMenu = nullptr;
    QAction* m_accountLoginAction = nullptr;
    QAction* m_accountLogoutAction = nullptr;
    QLabel* m_statusLabel;
    QLabel* m_healthLabel;
    QLabel* m_avatarLabel;
    QSystemTrayIcon* m_trayIcon;

    // Drag state
    bool m_draggingWindow = false;
    QPoint m_dragPos;
    bool m_maximized = false;
};
