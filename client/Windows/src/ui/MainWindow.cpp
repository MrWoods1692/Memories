#include "ui/MainWindow.h"
#include "ui/GalleryWidget.h"
#include "ui/ImageViewer.h"
#include "ui/UploadDialog.h"
#include "ui/SettingsDialog.h"
#include "ui/LoginDialog.h"
#include "app/Application.h"
#include "app/Settings.h"
#include "network/HealthChecker.h"
#include "network/ApiClient.h"
#include "utils/Logger.h"
#include "utils/ThemeManager.h"

#include <QMenuBar>
#include <QToolBar>
#include <QStatusBar>
#include <QMenu>
#include <QAction>
#include <QCloseEvent>
#include <QMouseEvent>
#include <QMessageBox>
#include <QApplication>
#include <QStyle>
#include <QtPrintSupport/QPrintDialog>
#include <QtPrintSupport/QPrinter>
#include <QFile>
#include <QTimer>
#include <QVBoxLayout>
#include <QHBoxLayout>

MainWindow::MainWindow(QWidget* parent)
    : QMainWindow(parent)
    , m_stack(new QStackedWidget(this))
    , m_gallery(nullptr)
    , m_viewer(nullptr)
    , m_uploadDlg(nullptr)
    , m_settingsDlg(nullptr)
    , m_loginDlg(nullptr)
    , m_titleBar(nullptr)
    , m_statusLabel(new QLabel(this))
    , m_healthLabel(new QLabel(this))
    , m_avatarLabel(new QLabel(this))
    , m_trayIcon(nullptr)
{
    setupUi();
    applyTheme();
    checkServiceHealth();
    updateUserDisplay();
}

MainWindow::~MainWindow() = default;

void MainWindow::setupUi() {
    setWindowTitle("Memories");
    setWindowIcon(QIcon(":/icons/app.svg"));
    resize(1360, 840);
    setMinimumSize(840, 620);

    // Main container: title bar + content
    auto* mainContainer = new QWidget(this);
    auto* mainVLayout = new QVBoxLayout(mainContainer);
    mainVLayout->setContentsMargins(0, 0, 0, 0);
    mainVLayout->setSpacing(0);
    setCentralWidget(mainContainer);

    // Suppress QMainWindow's built-in menu bar
    QMainWindow::setMenuBar(new QMenuBar(this));
    QMainWindow::menuBar()->setVisible(false);

    setupTitleBar();
    mainVLayout->addWidget(m_titleBar);

    // Menu bar as regular widget (not native)
    auto* menuBar = new QMenuBar(this);
    mainVLayout->addWidget(menuBar);
    setupMenuBar(menuBar);

    // Toolbar
    auto* toolbar = new QToolBar(tr("主工具栏"), this);
    toolbar->setMovable(false);
    toolbar->setIconSize(QSize(24, 24));
    mainVLayout->addWidget(toolbar);
    setupToolBar(toolbar);

    // Content
    m_stack->addWidget(m_gallery = new GalleryWidget(this));
    m_stack->addWidget(m_viewer = new ImageViewer(this));
    m_stack->setCurrentWidget(m_gallery);
    mainVLayout->addWidget(m_stack, 1);

    // Navigation
    connect(m_gallery, &GalleryWidget::imageSelected, this, &MainWindow::showImageViewer);
    connect(m_viewer, &ImageViewer::backToGallery, this, &MainWindow::showGallery);

    setupStatusBar();
    setupSystemTray();

    // Require login on startup
    if (!Application::instance()->settings()->isLoggedIn()) {
        QTimer::singleShot(200, this, [this]() {
            auto* dlg = new LoginDialog(this);
            dlg->setWindowFlags(Qt::Dialog | Qt::FramelessWindowHint);
            dlg->setModal(true);
            connect(dlg, &LoginDialog::loginSuccess, this, [this, dlg]() {
                updateUserDisplay();
                dlg->accept();
            });
            if (dlg->exec() != QDialog::Accepted) {
                QTimer::singleShot(0, qApp, &QApplication::quit);
            }
            dlg->deleteLater();
        });
    }
}

void MainWindow::setupTitleBar() {
    m_titleBar = new AppleTitleBar(this, "Memories", true);
    m_titleBar->setIcon(QIcon(":/icons/app.svg"));
}

// ---- Window dragging ----

void MainWindow::mousePressEvent(QMouseEvent* event) {
    if (event->button() == Qt::LeftButton && m_titleBar->geometry().contains(event->pos())) {
        m_draggingWindow = true;
        m_dragPos = event->globalPosition().toPoint() - frameGeometry().topLeft();
    }
}

void MainWindow::mouseMoveEvent(QMouseEvent* event) {
    if (m_draggingWindow && (event->buttons() & Qt::LeftButton)) {
        if (isMaximized()) showNormal();
        move(event->globalPosition().toPoint() - m_dragPos);
    }
}

void MainWindow::mouseReleaseEvent(QMouseEvent* event) {
    Q_UNUSED(event);
    m_draggingWindow = false;
}

void MainWindow::mouseDoubleClickEvent(QMouseEvent* event) {
    if (m_titleBar && m_titleBar->geometry().contains(event->pos())) {
        if (isMaximized()) showNormal();
        else showMaximized();
    }
}

void MainWindow::setupMenuBar(QMenuBar* menuBar) {
    auto* fileMenu = menuBar->addMenu(tr("文件(&F)"));

    auto* uploadAction = fileMenu->addAction(tr("上传图片(&U)..."));
    uploadAction->setShortcut(QKeySequence("Ctrl+U"));
    connect(uploadAction, &QAction::triggered, this, &MainWindow::showUploadDialog);

    fileMenu->addSeparator();

    auto* settingsAction = fileMenu->addAction(tr("设置(&S)..."));
    settingsAction->setShortcut(QKeySequence("Ctrl+,"));
    connect(settingsAction, &QAction::triggered, this, &MainWindow::showSettingsDialog);

    fileMenu->addSeparator();

    auto* exitAction = fileMenu->addAction(tr("退出(&X)"));
    exitAction->setShortcut(QKeySequence("Ctrl+Q"));
    connect(exitAction, &QAction::triggered, this, &QWidget::close);

    auto* viewMenu = menuBar->addMenu(tr("视图(&V)"));

    auto* galleryAction = viewMenu->addAction(tr("图片广场(&G)"));
    galleryAction->setShortcut(QKeySequence("Ctrl+G"));
    connect(galleryAction, &QAction::triggered, this, &MainWindow::showGallery);

    auto* refreshAction = viewMenu->addAction(tr("刷新(&R)"));
    refreshAction->setShortcut(QKeySequence("F5"));
    connect(refreshAction, &QAction::triggered, m_gallery, &GalleryWidget::loadImages);

    auto* accountMenu = menuBar->addMenu(tr("账号(&A)"));
    m_accountMenu = accountMenu;

    m_accountLoginAction = accountMenu->addAction(tr("登录(&L)..."));
    connect(m_accountLoginAction, &QAction::triggered, this, &MainWindow::showLoginDialog);

    m_accountLogoutAction = accountMenu->addAction(tr("登出(&O)"));
    m_accountLogoutAction->setVisible(false);
    connect(m_accountLogoutAction, &QAction::triggered, this, [this]() {
        Application::instance()->settings()->clearSession();
        Application::instance()->settings()->save();
        Application::instance()->apiClient()->setAccessToken("");
        updateUserDisplay();
    });

    auto* helpMenu = menuBar->addMenu(tr("帮助(&H)"));
    auto* aboutAction = helpMenu->addAction(tr("关于(&A)"));
    connect(aboutAction, &QAction::triggered, this, [this]() {
        QMessageBox::about(this, tr("关于 Memories"),
            tr("Memories v1.2.0\n跨平台图片管理与分享客户端。"));
    });
}

void MainWindow::setupToolBar(QToolBar* toolbar) {
    toolbar->setMovable(false);
    toolbar->setIconSize(QSize(24, 24));

    auto* galleryAction = toolbar->addAction(
        style()->standardIcon(QStyle::SP_DirIcon), tr("广场"));
    connect(galleryAction, &QAction::triggered, this, &MainWindow::showGallery);

    auto* uploadAction = toolbar->addAction(
        style()->standardIcon(QStyle::SP_FileDialogNewFolder), tr("上传"));
    connect(uploadAction, &QAction::triggered, this, &MainWindow::showUploadDialog);

    toolbar->addSeparator();

    // Avatar label
    m_avatarLabel->setFixedSize(32, 32);
    m_avatarLabel->setAlignment(Qt::AlignCenter);
    m_avatarLabel->setStyleSheet(
        "QLabel { background: qlineargradient(x1:0, y1:0, x2:0, y2:1, "
        "stop:0 #2A8E6E, stop:1 #1D6E5A); color: white; border-radius: 16px; "
        "font-weight: 700; font-size: 13px; min-width: 32px; min-height: 32px; "
        "border: 2px solid rgba(255,255,255,0.8); }");
    m_avatarLabel->setVisible(false);
    toolbar->addWidget(m_avatarLabel);
    toolbar->addSeparator();

    auto* loginAction = toolbar->addAction(
        style()->standardIcon(QStyle::SP_ComputerIcon), tr("登录"));
    loginAction->setObjectName("toolbarLoginBtn");
    connect(loginAction, &QAction::triggered, this, [this]() {
        if (Application::instance()->settings()->isLoggedIn()) {
            showLoginDialog(); // shows account info when logged in
        } else {
            showLoginDialog();
        }
    });
}

void MainWindow::setupStatusBar() {
    m_healthLabel->setProperty("statusPill", "checking");
    m_statusLabel->setProperty("statusText", true);
    statusBar()->addPermanentWidget(m_healthLabel);
    statusBar()->addPermanentWidget(m_statusLabel, 1);
    m_statusLabel->setText(tr("就绪"));
    m_healthLabel->setText(tr("● 检测中..."));
}

void MainWindow::setupSystemTray() {
    m_trayIcon = new QSystemTrayIcon(
        QIcon(":/icons/app.svg"), this);
    m_trayIcon->setToolTip("Memories");

    auto* trayMenu = new QMenu(this);
    trayMenu->addAction(tr("显示主窗口"), this, &QWidget::show);
    trayMenu->addAction(tr("上传图片..."), this, &MainWindow::showUploadDialog);
    trayMenu->addSeparator();
    trayMenu->addAction(tr("退出"), qApp, &QApplication::quit);

    m_trayIcon->setContextMenu(trayMenu);
    connect(m_trayIcon, &QSystemTrayIcon::activated, this, [this](QSystemTrayIcon::ActivationReason reason) {
        if (reason == QSystemTrayIcon::Trigger || reason == QSystemTrayIcon::DoubleClick) {
            if (isVisible()) {
                hide();
            } else {
                show();
                raise();
                activateWindow();
            }
        }
    });
    m_trayIcon->show();
}

void MainWindow::applyTheme() {
    QString theme = Application::instance()->settings()->theme();
    ThemeManager::instance().setTheme(theme);

    bool isDark = (theme == "dark");
    QString qss = ThemeManager::instance().buildStylesheet(isDark);
    qApp->setStyleSheet(qss);
}

void MainWindow::checkServiceHealth() {
    m_healthLabel->setText(tr("● Checking..."));
    m_healthLabel->setProperty("statusPill", "checking");
    m_healthLabel->style()->unpolish(m_healthLabel);
    m_healthLabel->style()->polish(m_healthLabel);
    auto* checker = Application::instance()->healthChecker();
    connect(checker, &HealthChecker::healthOk, this, [this]() {
        m_healthLabel->setText(tr("● 已连接"));
        m_healthLabel->setProperty("statusPill", "ok");
        m_healthLabel->style()->unpolish(m_healthLabel);
        m_healthLabel->style()->polish(m_healthLabel);
        m_statusLabel->setText(tr("服务运行正常"));
    });
    connect(checker, &HealthChecker::healthFail, this, [this](const QString& err) {
        m_healthLabel->setText(tr("● 未连接"));
        m_healthLabel->setProperty("statusPill", "error");
        m_healthLabel->style()->unpolish(m_healthLabel);
        m_healthLabel->style()->polish(m_healthLabel);
        m_statusLabel->setText(tr("服务不可达: ") + err);
    });
    checker->ping();
}

void MainWindow::onHealthCheckResult(bool ok) {
    if (ok) {
        m_gallery->loadImages();
    }
}

void MainWindow::showGallery() { m_stack->setCurrentWidget(m_gallery); }

void MainWindow::showImageViewer(const QString& imageUrl) {
    // Build image list from gallery
    QStringList urls;
    int currentIdx = 0;
    for (const auto& info : m_gallery->images()) {
        urls.append(info.url);
    }
    currentIdx = urls.indexOf(imageUrl);
    if (currentIdx < 0) currentIdx = 0;

    m_viewer->setImageList(urls, currentIdx);
    m_viewer->loadImage(imageUrl);
    m_stack->setCurrentWidget(m_viewer);
}

void MainWindow::showUploadDialog() {
    if (!m_uploadDlg) {
        m_uploadDlg = new UploadDialog(this);
    }
    m_uploadDlg->show();
    m_uploadDlg->raise();
}

void MainWindow::showSettingsDialog() {
    if (!m_settingsDlg) {
        m_settingsDlg = new SettingsDialog(this);
    }
    m_settingsDlg->show();
    m_settingsDlg->raise();
}

void MainWindow::showLoginDialog() {
    if (!m_loginDlg) {
        m_loginDlg = new LoginDialog(this);
        connect(m_loginDlg, &LoginDialog::loginSuccess, this, [this]() {
            updateUserDisplay();
        });
    }
    m_loginDlg->show();
    m_loginDlg->raise();
}

void MainWindow::onLoginSuccess() {
    updateUserDisplay();
}

void MainWindow::updateUserDisplay() {
    auto* s = Application::instance()->settings();
    if (s->isLoggedIn()) {
        QString username = s->userName();
        m_statusLabel->setText(username + " (QQ: " + s->userQq() + ")");
        setWindowTitle("Memories - " + username + " @" + s->userTenantName());

        m_avatarLabel->setText(username.isEmpty() ? "?" : username.left(1));
        m_avatarLabel->setVisible(true);

        m_accountLoginAction->setText(username.isEmpty() ? tr("我的") : username);
        m_accountLogoutAction->setVisible(true);
    } else {
        m_statusLabel->setText(tr("就绪 - 未登录"));
        setWindowTitle("Memories");
        m_avatarLabel->setVisible(false);

        m_accountLoginAction->setText(tr("登录(&L)..."));
        m_accountLogoutAction->setVisible(false);
    }
}

void MainWindow::closeEvent(QCloseEvent* event) {
    if (m_trayIcon && m_trayIcon->isVisible()) {
        hide();
        m_trayIcon->showMessage("Memories",
            tr("应用已最小化到系统托盘"), QSystemTrayIcon::Information, 2000);
        event->ignore();
    } else {
        event->accept();
    }
}
