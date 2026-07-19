#include "ui/FlowLayout.h"
#include <QWidget>
#include <QStyle>
#include <QToolButton>

FlowLayout::FlowLayout(QWidget* parent, int margin, int spacing)
    : QLayout(parent), m_hSpace(spacing), m_vSpace(spacing)
{
    setContentsMargins(margin, margin, margin, margin);
}

FlowLayout::~FlowLayout() {
    while (auto* item = takeAt(0))
        delete item;
}

void FlowLayout::addItem(QLayoutItem* item) {
    m_items.append(item);
}

QLayoutItem* FlowLayout::itemAt(int index) const {
    return (index >= 0 && index < m_items.size()) ? m_items[index] : nullptr;
}

QLayoutItem* FlowLayout::takeAt(int index) {
    return (index >= 0 && index < m_items.size()) ? m_items.takeAt(index) : nullptr;
}

int FlowLayout::horizontalSpacing() const {
    // 先检查 QLayout::spacing()（由 setSpacing 设置）
    int s = QLayout::spacing();
    if (s >= 0) return s;
    if (m_hSpace >= 0) return m_hSpace;
    return smartSpacing(QStyle::PM_LayoutHorizontalSpacing);
}

int FlowLayout::verticalSpacing() const {
    int s = QLayout::spacing();
    if (s >= 0) return s;
    if (m_vSpace >= 0) return m_vSpace;
    return smartSpacing(QStyle::PM_LayoutVerticalSpacing);
}

int FlowLayout::heightForWidth(int width) const {
    return doLayout(QRect(0, 0, width, 0), true);
}

QSize FlowLayout::minimumSize() const {
    QSize size;
    for (auto* item : m_items)
        size = size.expandedTo(item->minimumSize());
    int m = contentsMargins().left() + contentsMargins().right();
    return size + QSize(m, m);
}

QSize FlowLayout::sizeHint() const {
    return minimumSize();
}

void FlowLayout::setGeometry(const QRect& rect) {
    QLayout::setGeometry(rect);
    doLayout(rect, false);
}

int FlowLayout::doLayout(const QRect& rect, bool testOnly) const {
    int left, top, right, bottom;
    getContentsMargins(&left, &top, &right, &bottom);
    QRect effectiveRect = rect.adjusted(left, top, -right, -bottom);
    int x = effectiveRect.x();
    int y = effectiveRect.y();
    int lineHeight = 0;
    int availWidth = effectiveRect.width();
    int baseCellSize = m_cellSize;
    int hSpacing = horizontalSpacing();
    int vSpacing = verticalSpacing();

    // 动态计算每行能放多少格，并适当放大以填满可用宽度
    int perRow = (availWidth + hSpacing) / (baseCellSize + hSpacing);
    if (perRow < 1) perRow = 1;
    // 实际单元格大小：用剩余空间均分给每一格，但不放大超过 10%
    int totalSpacing = (perRow - 1) * hSpacing;
    int remaining = availWidth - totalSpacing;
    int dynamicCellSize = remaining / perRow;
    // 限制放大幅度
    if (dynamicCellSize > baseCellSize * 1.1) dynamicCellSize = baseCellSize * 1.1;
    if (dynamicCellSize < baseCellSize) dynamicCellSize = baseCellSize;

    int cellSize = dynamicCellSize;

    for (auto* item : m_items) {
        auto* w = item->widget();
        int span = w ? w->property("span").toInt() : 1;
        if (span < 1) span = 1;
        int itemWidth = cellSize * span + (span - 1) * hSpacing;
        int itemHeight = cellSize;

        // 如果当前行已有元素且放不下，换行
        if (lineHeight > 0 && x + itemWidth > effectiveRect.x() + availWidth) {
            x = effectiveRect.x();
            y += lineHeight + vSpacing;
            lineHeight = 0;
        }

        if (!testOnly) {
            item->setGeometry(QRect(QPoint(x, y), QSize(itemWidth, itemHeight)));
            // 同步更新 widget 的固定大小
            if (w) {
                w->setFixedSize(itemWidth, itemHeight);
                // 同步更新 QToolButton 图标大小（留 8px 边距）
                auto* tb = qobject_cast<QToolButton*>(w);
                if (tb && tb->toolButtonStyle() == Qt::ToolButtonIconOnly) {
                    tb->setIconSize(QSize(itemWidth - 8, itemHeight - 8));
                }
            }
        }

        x += itemWidth + hSpacing;
        lineHeight = qMax(lineHeight, itemHeight);
    }

    return y + lineHeight - rect.y() + bottom;
}

int FlowLayout::smartSpacing(QStyle::PixelMetric pm) const {
    auto* p = parentWidget();
    if (!p) return 0;
    return p->style()->pixelMetric(pm, nullptr, p);
}
