#include "ui/MessageBox.h"
#include "ui/AppleTitleBar.h"

#include <QLayout>

namespace {

QMessageBox::StandardButton showMessageBox(QWidget* parent,
                                           const QString& title,
                                           const QString& text,
                                           QMessageBox::Icon icon,
                                           QMessageBox::StandardButtons buttons,
                                           QMessageBox::StandardButton defaultButton)
{
    QMessageBox box(parent);
    box.setObjectName("appleMessageBox");
    box.setWindowTitle(title);
    box.setText(text);
    box.setIcon(icon);
    box.setStandardButtons(buttons);
    if (defaultButton != QMessageBox::NoButton) {
        box.setDefaultButton(defaultButton);
    }

    box.setWindowFlags(Qt::Dialog | Qt::FramelessWindowHint);
    box.layout()->setContentsMargins(0, 0, 0, 0);
    box.layout()->setMenuBar(new AppleTitleBar(&box, title, false));

    return static_cast<QMessageBox::StandardButton>(box.exec());
}

}

namespace MessageBox {

QMessageBox::StandardButton information(QWidget* parent, const QString& title, const QString& text)
{
    return showMessageBox(parent, title, text, QMessageBox::Information, QMessageBox::Ok, QMessageBox::Ok);
}

QMessageBox::StandardButton warning(QWidget* parent, const QString& title, const QString& text)
{
    return showMessageBox(parent, title, text, QMessageBox::Warning, QMessageBox::Ok, QMessageBox::Ok);
}

QMessageBox::StandardButton question(QWidget* parent, const QString& title, const QString& text,
                                      QMessageBox::StandardButtons buttons,
                                      QMessageBox::StandardButton defaultButton)
{
    return showMessageBox(parent, title, text, QMessageBox::Question, buttons, defaultButton);
}

void about(QWidget* parent, const QString& title, const QString& text)
{
    showMessageBox(parent, title, text, QMessageBox::Information, QMessageBox::Ok, QMessageBox::Ok);
}

}
