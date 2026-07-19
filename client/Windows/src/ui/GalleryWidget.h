#pragma once
#include <QWidget>
#include <QScrollArea>
#include <QWidget>
#include <QList>
#include "models/ImageModel.h"
#include "ui/FlowLayout.h"

class QPushButton;
class QProgressBar;
class QLabel;
class QStackedWidget;
class QToolButton;
class ApiClient;
class QNetworkAccessManager;

class GalleryWidget : public QWidget {
    Q_OBJECT
public:
    explicit GalleryWidget(QWidget* parent = nullptr);

    void loadImages();
    void clearSelection();
    QStringList selectedUrls() const;
    const QList<ImageInfo>& images() const { return m_images; }
    int selectedCount() const;

protected:
    void keyPressEvent(QKeyEvent* event) override;

signals:
    void imageSelected(const QString& url);
    void imagesSelected(const QStringList& urls);

private slots:
    void onImagesFetched(const QJsonArray& data, qint64 nextAfterId);
    void onFetchError(const QString& error);
    void onThumbnailClicked(const QString& url);
    void onSelectAll();
    void onDeselectAll();
    void onBatchDownload();
    void onBatchShare();
    void onBatchPrint();
    void onBatchCopyUrl();
    void loadMore();

private:
    void setupUi();
    void addThumbnail(const ImageInfo& info);
    void applyThumbnailPixmap(QToolButton* thumbBtn, const QPixmap& pixmap);
    void refreshGrid();

    QScrollArea* m_scrollArea;
    QWidget* m_gridContainer;
    FlowLayout* m_flowLayout;
    QStackedWidget* m_stateStack;
    QLabel* m_loadingLabel;
    QLabel* m_emptyLabel;
    QPushButton* m_loadMoreBtn;
    QPushButton* m_selectAllBtn;
    QPushButton* m_deselectAllBtn;
    QPushButton* m_batchDownloadBtn;
    QPushButton* m_batchShareBtn;
    QPushButton* m_batchPrintBtn;
    QPushButton* m_batchCopyBtn;
    QPushButton* m_selectModeBtn;
    QLabel* m_selectCountLabel;
    QProgressBar* m_progressBar;
    QNetworkAccessManager* m_networkManager;

    QList<ImageInfo> m_images;
    QMap<QString, bool> m_selections;  // url -> selected
    bool m_selectionMode = false;
    qint64 m_nextAfterId = 0;
    bool m_loading = false;
    bool m_hasMore = false;
};
