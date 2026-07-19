#pragma once
#include <QWidget>
#include <QScrollArea>
#include <QLabel>
#include <QPixmap>

class QSlider;
class QToolBar;
class QAction;

class ImageViewer : public QWidget {
    Q_OBJECT
public:
    explicit ImageViewer(QWidget* parent = nullptr);

    void loadImage(const QString& url);
    void setImageList(const QStringList& urls, int currentIndex);
    void clear();

signals:
    void backToGallery();
    void navigateTo(const QString& url);

private slots:
    void goToPrevious();
    void goToNext();
    void zoomIn();
    void zoomOut();
    void zoomReset();
    void rotateClockwise();
    void rotateCounterClockwise();
    void flipHorizontal();
    void flipVertical();
    void resetTransforms();
    void copyUrl();
    void downloadImage();
    void shareImage();
    void setAsWallpaper();
    void printImage();
    void showImageInfo();
    void onImageLoaded(const QPixmap& pixmap);

protected:
    bool eventFilter(QObject* obj, QEvent* event) override;
    void resizeEvent(QResizeEvent* event) override;

private:
    void setupUi();
    void setupToolBar();
    void applyTransforms();
    QPixmap transformedPixmap() const;

    QScrollArea* m_scrollArea;
    QLabel* m_imageLabel;
    QToolBar* m_toolBar;

    // Transform state
    QPixmap m_originalPixmap;
    QString m_currentUrl;
    double m_scaleFactor = 1.0;
    int m_rotation = 0;       // 0, 90, 180, 270
    bool m_flipH = false;
    bool m_flipV = false;

    // Actions
    QAction* m_zoomInAction;
    QAction* m_zoomOutAction;
    QAction* m_zoomResetAction;
    QAction* m_rotateCwAction;
    QAction* m_rotateCcwAction;
    QAction* m_flipHAction;
    QAction* m_flipVAction;
    QAction* m_resetAction;
    QAction* m_copyUrlAction;
    QAction* m_downloadAction;
    QAction* m_shareAction;
    QAction* m_wallpaperAction;
    QAction* m_printAction;
    QAction* m_infoAction;
    QAction* m_backAction;
    QAction* m_prevAction;
    QAction* m_nextAction;

    // Image list navigation
    QStringList m_imageList;
    int m_currentImageIndex = -1;

    // Drag state
    bool m_dragging = false;
    QPoint m_dragStartPos;
    QPoint m_dragScrollOrigin;
};
