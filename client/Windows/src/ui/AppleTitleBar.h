#pragma once
#include <QWidget>
#include <QLabel>
#include <QPushButton>
#include <QHBoxLayout>

// Apple-style title bar: 🔴🟡🟢 on left, icon+title centered
class AppleTitleBar : public QWidget {
    Q_OBJECT
public:
    explicit AppleTitleBar(QWidget* parentWindow, const QString& title = "", bool canMaximize = true);
    
    void setTitle(const QString& title);
    void setIcon(const QIcon& icon);

signals:
    void closeRequested();
    void minimizeRequested();
    void maximizeRequested();

private:
    QWidget* m_parentWindow;
    QPushButton* m_closeBtn;
    QPushButton* m_minBtn;
    QPushButton* m_maxBtn;
    QLabel* m_iconLabel;
    QLabel* m_titleLabel;
    bool m_canMaximize;
};
