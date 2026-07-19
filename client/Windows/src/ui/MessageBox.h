#pragma once

#include <QMessageBox>

namespace MessageBox {

QMessageBox::StandardButton information(QWidget* parent, const QString& title, const QString& text);
QMessageBox::StandardButton warning(QWidget* parent, const QString& title, const QString& text);
QMessageBox::StandardButton question(QWidget* parent, const QString& title, const QString& text,
                                      QMessageBox::StandardButtons buttons = QMessageBox::Yes | QMessageBox::No,
                                      QMessageBox::StandardButton defaultButton = QMessageBox::NoButton);
void about(QWidget* parent, const QString& title, const QString& text);

}
