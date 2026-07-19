#pragma once
#include <QLayout>
#include <QList>
#include <QSize>
#include <QWidget>
#include <QStyle>

// Simple flow layout with span support for image gallery
class FlowLayout : public QLayout {
public:
    explicit FlowLayout(QWidget* parent = nullptr, int margin = 0, int spacing = -1);
    ~FlowLayout();

    void addItem(QLayoutItem* item) override;
    int count() const override { return m_items.size(); }
    QLayoutItem* itemAt(int index) const override;
    QLayoutItem* takeAt(int index) override;

    Qt::Orientations expandingDirections() const override { return {}; }
    bool hasHeightForWidth() const override { return true; }
    int heightForWidth(int width) const override;

    QSize minimumSize() const override;
    QSize sizeHint() const override;
    void setGeometry(const QRect& rect) override;

    int horizontalSpacing() const;
    int verticalSpacing() const;

private:
    int doLayout(const QRect& rect, bool testOnly) const;
    int smartSpacing(QStyle::PixelMetric pm) const;

    QList<QLayoutItem*> m_items;
    int m_hSpace;
    int m_vSpace;
    int m_cellSize = 184; // base cell size
};
