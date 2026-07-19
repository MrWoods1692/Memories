#pragma once
#include <QDialog>
#include <QLabel>
#include <QTextEdit>
#include <QNetworkAccessManager>
#include "models/ImageModel.h"

class ImageInfoDialog : public QDialog {
    Q_OBJECT
public:
    explicit ImageInfoDialog(QWidget* parent = nullptr);

    void queryImage(const QString& imageUrl);

private:
    void setupUi();
    void displayInfo(const ImageInfo& info);

    QLabel* m_nameLabel;
    QLabel* m_storageLabel;
    QLabel* m_tagsLabel;
    QLabel* m_sizeLabel;
    QLabel* m_dimensionsLabel;
    QLabel* m_uploadDateLabel;
    QLabel* m_locationLabel;
    QLabel* m_urlLabel;
    QTextEdit* m_descEdit;
    QLabel* m_loadingLabel;

    QNetworkAccessManager* m_manager;
    ImageInfo m_currentInfo;
};
