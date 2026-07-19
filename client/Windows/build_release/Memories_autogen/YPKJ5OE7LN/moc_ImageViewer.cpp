/****************************************************************************
** Meta object code from reading C++ file 'ImageViewer.h'
**
** Created by: The Qt Meta Object Compiler version 68 (Qt 6.8.0)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "../../../src/ui/ImageViewer.h"
#include <QtGui/qtextcursor.h>
#include <QtCore/qmetatype.h>

#include <QtCore/qtmochelpers.h>

#include <memory>


#include <QtCore/qxptype_traits.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'ImageViewer.h' doesn't include <QObject>."
#elif Q_MOC_OUTPUT_REVISION != 68
#error "This file was generated using the moc from 6.8.0. It"
#error "cannot be used with the include files from this version of Qt."
#error "(The moc has changed too much.)"
#endif

#ifndef Q_CONSTINIT
#define Q_CONSTINIT
#endif

QT_WARNING_PUSH
QT_WARNING_DISABLE_DEPRECATED
QT_WARNING_DISABLE_GCC("-Wuseless-cast")
namespace {

#ifdef QT_MOC_HAS_STRINGDATA
struct qt_meta_stringdata_CLASSImageViewerENDCLASS_t {};
constexpr auto qt_meta_stringdata_CLASSImageViewerENDCLASS = QtMocHelpers::stringData(
    "ImageViewer",
    "backToGallery",
    "",
    "navigateTo",
    "url",
    "goToPrevious",
    "goToNext",
    "zoomIn",
    "zoomOut",
    "zoomReset",
    "rotateClockwise",
    "rotateCounterClockwise",
    "flipHorizontal",
    "flipVertical",
    "resetTransforms",
    "copyUrl",
    "downloadImage",
    "shareImage",
    "setAsWallpaper",
    "printImage",
    "showImageInfo",
    "onImageLoaded",
    "pixmap"
);
#else  // !QT_MOC_HAS_STRINGDATA
#error "qtmochelpers.h not found or too old."
#endif // !QT_MOC_HAS_STRINGDATA
} // unnamed namespace

Q_CONSTINIT static const uint qt_meta_data_CLASSImageViewerENDCLASS[] = {

 // content:
      12,       // revision
       0,       // classname
       0,    0, // classinfo
      19,   14, // methods
       0,    0, // properties
       0,    0, // enums/sets
       0,    0, // constructors
       0,       // flags
       2,       // signalCount

 // signals: name, argc, parameters, tag, flags, initial metatype offsets
       1,    0,  128,    2, 0x06,    1 /* Public */,
       3,    1,  129,    2, 0x06,    2 /* Public */,

 // slots: name, argc, parameters, tag, flags, initial metatype offsets
       5,    0,  132,    2, 0x08,    4 /* Private */,
       6,    0,  133,    2, 0x08,    5 /* Private */,
       7,    0,  134,    2, 0x08,    6 /* Private */,
       8,    0,  135,    2, 0x08,    7 /* Private */,
       9,    0,  136,    2, 0x08,    8 /* Private */,
      10,    0,  137,    2, 0x08,    9 /* Private */,
      11,    0,  138,    2, 0x08,   10 /* Private */,
      12,    0,  139,    2, 0x08,   11 /* Private */,
      13,    0,  140,    2, 0x08,   12 /* Private */,
      14,    0,  141,    2, 0x08,   13 /* Private */,
      15,    0,  142,    2, 0x08,   14 /* Private */,
      16,    0,  143,    2, 0x08,   15 /* Private */,
      17,    0,  144,    2, 0x08,   16 /* Private */,
      18,    0,  145,    2, 0x08,   17 /* Private */,
      19,    0,  146,    2, 0x08,   18 /* Private */,
      20,    0,  147,    2, 0x08,   19 /* Private */,
      21,    1,  148,    2, 0x08,   20 /* Private */,

 // signals: parameters
    QMetaType::Void,
    QMetaType::Void, QMetaType::QString,    4,

 // slots: parameters
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void, QMetaType::QPixmap,   22,

       0        // eod
};

Q_CONSTINIT const QMetaObject ImageViewer::staticMetaObject = { {
    QMetaObject::SuperData::link<QWidget::staticMetaObject>(),
    qt_meta_stringdata_CLASSImageViewerENDCLASS.offsetsAndSizes,
    qt_meta_data_CLASSImageViewerENDCLASS,
    qt_static_metacall,
    nullptr,
    qt_incomplete_metaTypeArray<qt_meta_stringdata_CLASSImageViewerENDCLASS_t,
        // Q_OBJECT / Q_GADGET
        QtPrivate::TypeAndForceComplete<ImageViewer, std::true_type>,
        // method 'backToGallery'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'navigateTo'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QString &, std::false_type>,
        // method 'goToPrevious'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'goToNext'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'zoomIn'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'zoomOut'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'zoomReset'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'rotateClockwise'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'rotateCounterClockwise'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'flipHorizontal'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'flipVertical'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'resetTransforms'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'copyUrl'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'downloadImage'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'shareImage'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'setAsWallpaper'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'printImage'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'showImageInfo'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'onImageLoaded'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QPixmap &, std::false_type>
    >,
    nullptr
} };

void ImageViewer::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    if (_c == QMetaObject::InvokeMetaMethod) {
        auto *_t = static_cast<ImageViewer *>(_o);
        (void)_t;
        switch (_id) {
        case 0: _t->backToGallery(); break;
        case 1: _t->navigateTo((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1]))); break;
        case 2: _t->goToPrevious(); break;
        case 3: _t->goToNext(); break;
        case 4: _t->zoomIn(); break;
        case 5: _t->zoomOut(); break;
        case 6: _t->zoomReset(); break;
        case 7: _t->rotateClockwise(); break;
        case 8: _t->rotateCounterClockwise(); break;
        case 9: _t->flipHorizontal(); break;
        case 10: _t->flipVertical(); break;
        case 11: _t->resetTransforms(); break;
        case 12: _t->copyUrl(); break;
        case 13: _t->downloadImage(); break;
        case 14: _t->shareImage(); break;
        case 15: _t->setAsWallpaper(); break;
        case 16: _t->printImage(); break;
        case 17: _t->showImageInfo(); break;
        case 18: _t->onImageLoaded((*reinterpret_cast< std::add_pointer_t<QPixmap>>(_a[1]))); break;
        default: ;
        }
    } else if (_c == QMetaObject::IndexOfMethod) {
        int *result = reinterpret_cast<int *>(_a[0]);
        {
            using _t = void (ImageViewer::*)();
            if (_t _q_method = &ImageViewer::backToGallery; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 0;
                return;
            }
        }
        {
            using _t = void (ImageViewer::*)(const QString & );
            if (_t _q_method = &ImageViewer::navigateTo; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 1;
                return;
            }
        }
    }
}

const QMetaObject *ImageViewer::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *ImageViewer::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_meta_stringdata_CLASSImageViewerENDCLASS.stringdata0))
        return static_cast<void*>(this);
    return QWidget::qt_metacast(_clname);
}

int ImageViewer::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QWidget::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        if (_id < 19)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 19;
    } else if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        if (_id < 19)
            *reinterpret_cast<QMetaType *>(_a[0]) = QMetaType();
        _id -= 19;
    }
    return _id;
}

// SIGNAL 0
void ImageViewer::backToGallery()
{
    QMetaObject::activate(this, &staticMetaObject, 0, nullptr);
}

// SIGNAL 1
void ImageViewer::navigateTo(const QString & _t1)
{
    void *_a[] = { nullptr, const_cast<void*>(reinterpret_cast<const void*>(std::addressof(_t1))) };
    QMetaObject::activate(this, &staticMetaObject, 1, _a);
}
QT_WARNING_POP
