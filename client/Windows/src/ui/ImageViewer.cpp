#include "ui/ImageViewer.h"
#include "ui/ImageInfoDialog.h"
#include "app/Application.h"
#include "app/Settings.h"
#include "utils/ImageCache.h"
#include "utils/Logger.h"

#include <QVBoxLayout>
#include <QToolBar>
#include <QAction>
#include <QScrollArea>
#include <QScrollBar>
#include <QLabel>
#include <QSlider>
#include <QClipboard>
#include <QApplication>
#include <QFileDialog>
#include <QDesktopServices>
#include <QMessageBox>
#include <QPrinter>
#include <QtPrintSupport/QPrintDialog>
#include <QPainter>
#include <QShortcut>
#include <QStyle>
#include <QProcess>
#include <QtMath>
#include <QNetworkReply>
#include <QNetworkAccessManager>
#include <QWheelEvent>
#include <QMouseEvent>
#include <QResizeEvent>
#include <QScrollArea>
#include <QTimer>
#include <windows.h>

namespace {
constexpr double kMinPreviewScale = 0.05;
constexpr double kMaxPreviewScale = 8.0;
constexpr qint64 kMaxPreviewPixels = 25000000;

QSize limitedPreviewSize(const QSize& sourceSize, double scaleFactor) {
    if (sourceSize.isEmpty()) return QSize();

    QSizeF scaledSize(sourceSize.width() * scaleFactor, sourceSize.height() * scaleFactor);
    double pixelCount = scaledSize.width() * scaledSize.height();
    if (pixelCount > kMaxPreviewPixels) {
        double limitFactor = qSqrt(static_cast<double>(kMaxPreviewPixels) / pixelCount);
        scaledSize *= limitFactor;
    }

    return QSize(qMax(1, qRound(scaledSize.width())), qMax(1, qRound(scaledSize.height())));
}
}

ImageViewer::ImageViewer(QWidget* parent)
    : QWidget(parent)
    , m_scrollArea(new QScrollArea(this))
    , m_imageLabel(new QLabel(this))
    , m_toolBar(new QToolBar(tr("图片工具"), this))
{
    setupUi();
}

void ImageViewer::setupUi() {
    auto* mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(0, 0, 0, 0);

    setupToolBar();
    mainLayout->addWidget(m_toolBar);

    // Image display - fit to view while keeping aspect ratio
    m_imageLabel->setAlignment(Qt::AlignCenter);
    m_imageLabel->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    m_imageLabel->setScaledContents(false);
    m_imageLabel->setMinimumSize(1, 1);
    m_imageLabel->setAcceptDrops(true);

    m_scrollArea->setWidget(m_imageLabel);
    m_scrollArea->setWidgetResizable(false);
    m_scrollArea->setAlignment(Qt::AlignCenter);
    mainLayout->addWidget(m_scrollArea, 1);

    // Install event filter on viewport for drag + wheel zoom
    m_scrollArea->viewport()->installEventFilter(this);
    m_scrollArea->viewport()->setCursor(Qt::OpenHandCursor);
    m_scrollArea->viewport()->setMouseTracking(true);

    // Keyboard shortcuts
    auto* zoomInShortcut = new QShortcut(QKeySequence("Ctrl++"), this);
    connect(zoomInShortcut, &QShortcut::activated, this, &ImageViewer::zoomIn);

    auto* zoomOutShortcut = new QShortcut(QKeySequence("Ctrl+-"), this);
    connect(zoomOutShortcut, &QShortcut::activated, this, &ImageViewer::zoomOut);

    auto* zoomResetShortcut = new QShortcut(QKeySequence("Ctrl+0"), this);
    connect(zoomResetShortcut, &QShortcut::activated, this, &ImageViewer::zoomReset);

    auto* copyShortcut = new QShortcut(QKeySequence("Ctrl+C"), this);
    connect(copyShortcut, &QShortcut::activated, this, &ImageViewer::copyUrl);

    auto* escShortcut = new QShortcut(QKeySequence("Escape"), this);
    connect(escShortcut, &QShortcut::activated, this, &ImageViewer::backToGallery);

    auto* leftShortcut = new QShortcut(QKeySequence(Qt::Key_Left), this);
    connect(leftShortcut, &QShortcut::activated, this, &ImageViewer::goToPrevious);

    auto* rightShortcut = new QShortcut(QKeySequence(Qt::Key_Right), this);
    connect(rightShortcut, &QShortcut::activated, this, &ImageViewer::goToNext);
}

void ImageViewer::setupToolBar() {
    m_toolBar->setIconSize(QSize(22, 22));
    m_toolBar->setMovable(false);
    m_toolBar->setToolButtonStyle(Qt::ToolButtonIconOnly);

    m_backAction = m_toolBar->addAction(QIcon(":/icons/ic_back.svg"), tr("返回"));
    m_backAction->setToolTip(tr("返回图片广场 (Esc)"));
    connect(m_backAction, &QAction::triggered, this, &ImageViewer::backToGallery);

    m_prevAction = m_toolBar->addAction(QIcon(":/icons/ic_prev.svg"), tr("上一张"));
    m_prevAction->setToolTip(tr("上一张 (←)"));
    connect(m_prevAction, &QAction::triggered, this, &ImageViewer::goToPrevious);

    m_nextAction = m_toolBar->addAction(QIcon(":/icons/ic_next.svg"), tr("下一张"));
    m_nextAction->setToolTip(tr("下一张 (→)"));
    connect(m_nextAction, &QAction::triggered, this, &ImageViewer::goToNext);

    m_toolBar->addSeparator();

    m_zoomInAction = m_toolBar->addAction(QIcon(":/icons/ic_zoom_in.svg"), tr("放大"));
    m_zoomInAction->setToolTip(tr("放大 (Ctrl++)"));
    connect(m_zoomInAction, &QAction::triggered, this, &ImageViewer::zoomIn);

    m_zoomOutAction = m_toolBar->addAction(QIcon(":/icons/ic_zoom_out.svg"), tr("缩小"));
    m_zoomOutAction->setToolTip(tr("缩小 (Ctrl+-)"));
    connect(m_zoomOutAction, &QAction::triggered, this, &ImageViewer::zoomOut);

    m_zoomResetAction = m_toolBar->addAction(QIcon(":/icons/ic_reset.svg"), tr("原始"));
    m_zoomResetAction->setToolTip(tr("重置缩放 (Ctrl+0)"));
    connect(m_zoomResetAction, &QAction::triggered, this, &ImageViewer::zoomReset);

    m_toolBar->addSeparator();

    m_rotateCwAction = m_toolBar->addAction(QIcon(":/icons/ic_rotate_cw.svg"), tr("右旋"));
    m_rotateCwAction->setToolTip(tr("顺时针旋转 90°"));
    connect(m_rotateCwAction, &QAction::triggered, this, &ImageViewer::rotateClockwise);

    m_rotateCcwAction = m_toolBar->addAction(QIcon(":/icons/ic_rotate_ccw.svg"), tr("左旋"));
    m_rotateCcwAction->setToolTip(tr("逆时针旋转 90°"));
    connect(m_rotateCcwAction, &QAction::triggered, this, &ImageViewer::rotateCounterClockwise);

    m_toolBar->addSeparator();

    m_flipHAction = m_toolBar->addAction(QIcon(":/icons/ic_flip_h.svg"), tr("水平翻转"));
    m_flipHAction->setToolTip(tr("左右镜像翻转"));
    connect(m_flipHAction, &QAction::triggered, this, &ImageViewer::flipHorizontal);

    m_flipVAction = m_toolBar->addAction(QIcon(":/icons/ic_flip_v.svg"), tr("垂直翻转"));
    m_flipVAction->setToolTip(tr("上下镜像翻转"));
    connect(m_flipVAction, &QAction::triggered, this, &ImageViewer::flipVertical);

    m_toolBar->addSeparator();

    m_resetAction = m_toolBar->addAction(QIcon(":/icons/ic_reset.svg"), tr("还原"));
    m_resetAction->setToolTip(tr("还原所有变换"));
    connect(m_resetAction, &QAction::triggered, this, &ImageViewer::resetTransforms);

    m_toolBar->addSeparator();

    m_copyUrlAction = m_toolBar->addAction(QIcon(":/icons/ic_copy_link.svg"), tr("复制链接"));
    m_copyUrlAction->setToolTip(tr("复制图片链接 (Ctrl+C)"));
    connect(m_copyUrlAction, &QAction::triggered, this, &ImageViewer::copyUrl);

    m_downloadAction = m_toolBar->addAction(QIcon(":/icons/ic_download.svg"), tr("下载"));
    m_downloadAction->setToolTip(tr("下载图片"));
    connect(m_downloadAction, &QAction::triggered, this, &ImageViewer::downloadImage);

    m_shareAction = m_toolBar->addAction(QIcon(":/icons/ic_share.svg"), tr("分享"));
    m_shareAction->setToolTip(tr("分享图片"));
    connect(m_shareAction, &QAction::triggered, this, &ImageViewer::shareImage);

    m_wallpaperAction = m_toolBar->addAction(QIcon(":/icons/ic_wallpaper.svg"), tr("设为壁纸"));
    m_wallpaperAction->setToolTip(tr("设为桌面壁纸"));
    connect(m_wallpaperAction, &QAction::triggered, this, &ImageViewer::setAsWallpaper);

    m_printAction = m_toolBar->addAction(QIcon(":/icons/ic_print.svg"), tr("打印"));
    m_printAction->setToolTip(tr("打印图片"));
    connect(m_printAction, &QAction::triggered, this, &ImageViewer::printImage);

    m_infoAction = m_toolBar->addAction(QIcon(":/icons/ic_info.svg"), tr("信息"));
    m_infoAction->setToolTip(tr("显示图片信息"));
    connect(m_infoAction, &QAction::triggered, this, &ImageViewer::showImageInfo);
}

void ImageViewer::loadImage(const QString& url) {
    m_currentUrl = url;
    resetTransforms();

    auto* cache = Application::instance()->imageCache();
    QPixmap cached = cache->getPixmap(url);

    if (!cached.isNull()) {
        onImageLoaded(cached);
    } else {
        // Async download and cache
        m_imageLabel->setText(tr("加载中..."));
        auto* manager = new QNetworkAccessManager(this);
        QNetworkRequest req{QUrl(url)};
        auto* reply = manager->get(req);
        connect(reply, &QNetworkReply::finished, this, [this, cache, url]() {
            auto* finishedReply = qobject_cast<QNetworkReply*>(sender());
            finishedReply->deleteLater();
            if (finishedReply->error() == QNetworkReply::NoError) {
                QByteArray data = finishedReply->readAll();
                QPixmap pixmap;
                if (cache->putData(url, data, &pixmap)) {
                    onImageLoaded(pixmap);
                }
            } else {
                m_imageLabel->setText(tr("图片加载失败"));
            }
        });
    }
}

void ImageViewer::onImageLoaded(const QPixmap& pixmap) {
    m_originalPixmap = pixmap;
    m_scaleFactor = 1.0;
    // Delay to ensure viewport is sized
    QTimer::singleShot(50, this, [this]() { applyTransforms(); });
}

void ImageViewer::applyTransforms() {
    if (m_originalPixmap.isNull()) return;

    QPixmap result = transformedPixmap();

    // If scale is 1.0, fit to viewport; otherwise use exact scale factor
    if (qFuzzyCompare(m_scaleFactor, 1.0)) {
        QSize viewSize = m_scrollArea->viewport()->size();
        if (viewSize.width() > 0 && viewSize.height() > 0) {
            result = result.scaled(viewSize, Qt::KeepAspectRatio, Qt::SmoothTransformation);
        }
    } else {
        QSize newSize = limitedPreviewSize(result.size(), m_scaleFactor);
        result = result.scaled(newSize, Qt::KeepAspectRatio, Qt::SmoothTransformation);
    }

    m_imageLabel->setPixmap(result);
    m_imageLabel->resize(result.size());
}

QPixmap ImageViewer::transformedPixmap() const {
    QPixmap result = m_originalPixmap;

    // Apply rotation
    if (m_rotation != 0) {
        QTransform rot;
        rot.rotate(m_rotation);
        result = result.transformed(rot, Qt::SmoothTransformation);
    }

    // Apply flip
    if (m_flipH || m_flipV) {
        result = result.transformed(QTransform().scale(
            m_flipH ? -1.0 : 1.0, m_flipV ? -1.0 : 1.0));
    }

    return result;
}

void ImageViewer::zoomIn() {
    m_scaleFactor = qMin(m_scaleFactor * 1.25, kMaxPreviewScale);
    applyTransforms();
}

void ImageViewer::zoomOut() {
    m_scaleFactor = qMax(m_scaleFactor / 1.25, kMinPreviewScale);
    applyTransforms();
}

void ImageViewer::zoomReset() {
    m_scaleFactor = 1.0;
    applyTransforms();
}

void ImageViewer::rotateClockwise() {
    m_rotation = (m_rotation + 90) % 360;
    applyTransforms();
}

void ImageViewer::rotateCounterClockwise() {
    m_rotation = (m_rotation - 90 + 360) % 360;
    applyTransforms();
}

void ImageViewer::flipHorizontal() {
    m_flipH = !m_flipH;
    applyTransforms();
}

void ImageViewer::flipVertical() {
    m_flipV = !m_flipV;
    applyTransforms();
}

void ImageViewer::resetTransforms() {
    m_scaleFactor = 1.0;
    m_rotation = 0;
    m_flipH = false;
    m_flipV = false;
    applyTransforms();
}

void ImageViewer::clear() {
    m_originalPixmap = QPixmap();
    m_currentUrl.clear();
    m_imageLabel->clear();
    resetTransforms();
}

void ImageViewer::copyUrl() {
    if (m_currentUrl.isEmpty()) return;
    QApplication::clipboard()->setText(m_currentUrl);
    LOG_INFO("Copied URL: " + m_currentUrl);
}

void ImageViewer::downloadImage() {
    if (m_currentUrl.isEmpty()) return;

    QString defaultName = m_currentUrl.section('/', -1);
    QString downloadDir = Application::instance()->settings()->downloadLocation();

    QDir dir(downloadDir);
    if (!dir.exists()) {
        dir.mkpath(".");
    }

    QString filePath = downloadDir + "/" + defaultName;
    int counter = 1;
    while (QFile::exists(filePath)) {
        QString baseName = defaultName.section('.', 0, -2);
        QString extension = defaultName.section('.', -1);
        filePath = downloadDir + "/" + baseName + "_" + QString::number(counter) + "." + extension;
        counter++;
    }

    auto pixmap = transformedPixmap();
    if (pixmap.save(filePath)) {
        LOG_INFO("Saved image to: " + filePath);
        QMessageBox::information(this, tr("下载完成"),
            tr("图片已保存到:\n%1").arg(filePath));
    } else {
        LOG_ERROR("Failed to save image to: " + filePath);
        QMessageBox::warning(this, tr("下载失败"),
            tr("无法保存图片，请检查下载位置权限。"));
    }
}

void ImageViewer::shareImage() {
    QApplication::clipboard()->setText(m_currentUrl);
    QMessageBox::information(this, tr("分享"), tr("图片链接已复制到剪贴板。"));
}

void ImageViewer::setAsWallpaper() {
    if (m_currentUrl.isEmpty()) return;

    QString tmpPath = QDir::tempPath() + "/memories_wallpaper.png";
    auto pixmap = transformedPixmap();
    pixmap.save(tmpPath);

#ifdef Q_OS_WINDOWS
    const wchar_t* widePath = reinterpret_cast<const wchar_t*>(tmpPath.utf16());
    SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, (LPVOID)widePath, SPIF_UPDATEINIFILE | SPIF_SENDCHANGE);
#else
    QStringList cmds = {
        "gsettings set org.gnome.desktop.background picture-uri file://" + tmpPath,
        "gsettings set org.gnome.desktop.background picture-uri-dark file://" + tmpPath,
    };
    for (const auto& cmd : cmds) {
        QProcess::execute("bash", {"-c", cmd});
    }
#endif

    QMessageBox::information(this, tr("壁纸"), tr("壁纸已更新。"));
}

void ImageViewer::printImage() {
    if (m_originalPixmap.isNull()) return;

    QPrinter printer;
    QPrintDialog printDlg(&printer, this);
    if (printDlg.exec() != QDialog::Accepted) return;

    QPainter painter(&printer);
    auto pixmap = transformedPixmap();
    QRect rect = painter.viewport();
    QSize size = pixmap.size();
    size.scale(rect.size(), Qt::KeepAspectRatio);
    painter.setViewport(rect.x(), rect.y(), size.width(), size.height());
    painter.setWindow(pixmap.rect());
    painter.drawPixmap(0, 0, pixmap);
    painter.end();
}

void ImageViewer::showImageInfo() {
    auto* dlg = new ImageInfoDialog(this);
    dlg->setAttribute(Qt::WA_DeleteOnClose);
    dlg->queryImage(m_currentUrl);
    dlg->show();
}

void ImageViewer::setImageList(const QStringList& urls, int currentIndex) {
    m_imageList = urls;
    m_currentImageIndex = currentIndex;
    m_prevAction->setEnabled(m_currentImageIndex > 0);
    m_nextAction->setEnabled(m_currentImageIndex < m_imageList.size() - 1);
}

void ImageViewer::goToPrevious() {
    if (m_currentImageIndex <= 0 || m_imageList.isEmpty()) return;
    m_currentImageIndex--;
    loadImage(m_imageList[m_currentImageIndex]);
    m_prevAction->setEnabled(m_currentImageIndex > 0);
    m_nextAction->setEnabled(m_currentImageIndex < m_imageList.size() - 1);
}

void ImageViewer::goToNext() {
    if (m_currentImageIndex < 0 || m_currentImageIndex >= m_imageList.size() - 1) return;
    m_currentImageIndex++;
    loadImage(m_imageList[m_currentImageIndex]);
    m_prevAction->setEnabled(m_currentImageIndex > 0);
    m_nextAction->setEnabled(m_currentImageIndex < m_imageList.size() - 1);
}

// ---- Resize to re-fit image ----

void ImageViewer::resizeEvent(QResizeEvent* event) {
    QWidget::resizeEvent(event);
    if (!m_originalPixmap.isNull()) {
        applyTransforms();
    }
}

// ---- Drag to pan ----

bool ImageViewer::eventFilter(QObject* obj, QEvent* event) {
    if (obj != m_scrollArea->viewport()) {
        return QWidget::eventFilter(obj, event);
    }

    // Wheel -> zoom only, never scroll
    if (event->type() == QEvent::Wheel) {
        auto* we = static_cast<QWheelEvent*>(event);
        double factor = (we->angleDelta().y() > 0) ? 1.12 : (1.0 / 1.12);
        double newScale = m_scaleFactor * factor;
        newScale = qBound(kMinPreviewScale, newScale, kMaxPreviewScale);

        if (qFuzzyCompare(newScale, m_scaleFactor)) return true;

        QPoint viewportPos = we->position().toPoint();
        QPointF scenePos(
            (m_scrollArea->horizontalScrollBar()->value() + viewportPos.x()) / m_scaleFactor,
            (m_scrollArea->verticalScrollBar()->value() + viewportPos.y()) / m_scaleFactor
        );

        m_scaleFactor = newScale;
        applyTransforms();

        m_scrollArea->horizontalScrollBar()->setValue(
            qRound(scenePos.x() * m_scaleFactor - viewportPos.x()));
        m_scrollArea->verticalScrollBar()->setValue(
            qRound(scenePos.y() * m_scaleFactor - viewportPos.y()));
        return true;
    }

    // Mouse drag for panning
    if (event->type() == QEvent::MouseButtonPress) {
        auto* me = static_cast<QMouseEvent*>(event);
        if (me->button() == Qt::LeftButton) {
            m_dragging = true;
            m_dragStartPos = me->pos();
            m_dragScrollOrigin = QPoint(
                m_scrollArea->horizontalScrollBar()->value(),
                m_scrollArea->verticalScrollBar()->value());
            m_scrollArea->viewport()->setCursor(Qt::ClosedHandCursor);
            return true;
        }
    }

    if (event->type() == QEvent::MouseMove && m_dragging) {
        auto* me = static_cast<QMouseEvent*>(event);
        QPoint delta = m_dragStartPos - me->pos();
        m_scrollArea->horizontalScrollBar()->setValue(m_dragScrollOrigin.x() + delta.x());
        m_scrollArea->verticalScrollBar()->setValue(m_dragScrollOrigin.y() + delta.y());
        return true;
    }

    if (event->type() == QEvent::MouseButtonRelease && m_dragging) {
        m_dragging = false;
        m_scrollArea->viewport()->setCursor(Qt::OpenHandCursor);
        return true;
    }

    return QWidget::eventFilter(obj, event);
}
