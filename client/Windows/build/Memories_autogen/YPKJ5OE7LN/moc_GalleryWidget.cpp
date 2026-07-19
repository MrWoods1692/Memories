/****************************************************************************
** Meta object code from reading C++ file 'GalleryWidget.h'
**
** Created by: The Qt Meta Object Compiler version 68 (Qt 6.8.0)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "../../../src/ui/GalleryWidget.h"
#include <QtCore/qmetatype.h>

#include <QtCore/qtmochelpers.h>

#include <memory>


#include <QtCore/qxptype_traits.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'GalleryWidget.h' doesn't include <QObject>."
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
struct qt_meta_stringdata_CLASSGalleryWidgetENDCLASS_t {};
constexpr auto qt_meta_stringdata_CLASSGalleryWidgetENDCLASS = QtMocHelpers::stringData(
    "GalleryWidget",
    "imageSelected",
    "",
    "url",
    "imagesSelected",
    "urls",
    "onImagesFetched",
    "data",
    "nextAfterId",
    "onFetchError",
    "error",
    "onThumbnailClicked",
    "onSelectAll",
    "onDeselectAll",
    "onBatchDownload",
    "onBatchShare",
    "onBatchPrint",
    "onBatchCopyUrl",
    "loadMore"
);
#else  // !QT_MOC_HAS_STRINGDATA
#error "qtmochelpers.h not found or too old."
#endif // !QT_MOC_HAS_STRINGDATA
} // unnamed namespace

Q_CONSTINIT static const uint qt_meta_data_CLASSGalleryWidgetENDCLASS[] = {

 // content:
      12,       // revision
       0,       // classname
       0,    0, // classinfo
      12,   14, // methods
       0,    0, // properties
       0,    0, // enums/sets
       0,    0, // constructors
       0,       // flags
       2,       // signalCount

 // signals: name, argc, parameters, tag, flags, initial metatype offsets
       1,    1,   86,    2, 0x06,    1 /* Public */,
       4,    1,   89,    2, 0x06,    3 /* Public */,

 // slots: name, argc, parameters, tag, flags, initial metatype offsets
       6,    2,   92,    2, 0x08,    5 /* Private */,
       9,    1,   97,    2, 0x08,    8 /* Private */,
      11,    1,  100,    2, 0x08,   10 /* Private */,
      12,    0,  103,    2, 0x08,   12 /* Private */,
      13,    0,  104,    2, 0x08,   13 /* Private */,
      14,    0,  105,    2, 0x08,   14 /* Private */,
      15,    0,  106,    2, 0x08,   15 /* Private */,
      16,    0,  107,    2, 0x08,   16 /* Private */,
      17,    0,  108,    2, 0x08,   17 /* Private */,
      18,    0,  109,    2, 0x08,   18 /* Private */,

 // signals: parameters
    QMetaType::Void, QMetaType::QString,    3,
    QMetaType::Void, QMetaType::QStringList,    5,

 // slots: parameters
    QMetaType::Void, QMetaType::QJsonArray, QMetaType::LongLong,    7,    8,
    QMetaType::Void, QMetaType::QString,   10,
    QMetaType::Void, QMetaType::QString,    3,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,

       0        // eod
};

Q_CONSTINIT const QMetaObject GalleryWidget::staticMetaObject = { {
    QMetaObject::SuperData::link<QWidget::staticMetaObject>(),
    qt_meta_stringdata_CLASSGalleryWidgetENDCLASS.offsetsAndSizes,
    qt_meta_data_CLASSGalleryWidgetENDCLASS,
    qt_static_metacall,
    nullptr,
    qt_incomplete_metaTypeArray<qt_meta_stringdata_CLASSGalleryWidgetENDCLASS_t,
        // Q_OBJECT / Q_GADGET
        QtPrivate::TypeAndForceComplete<GalleryWidget, std::true_type>,
        // method 'imageSelected'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QString &, std::false_type>,
        // method 'imagesSelected'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QStringList &, std::false_type>,
        // method 'onImagesFetched'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QJsonArray &, std::false_type>,
        QtPrivate::TypeAndForceComplete<qint64, std::false_type>,
        // method 'onFetchError'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QString &, std::false_type>,
        // method 'onThumbnailClicked'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QString &, std::false_type>,
        // method 'onSelectAll'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'onDeselectAll'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'onBatchDownload'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'onBatchShare'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'onBatchPrint'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'onBatchCopyUrl'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'loadMore'
        QtPrivate::TypeAndForceComplete<void, std::false_type>
    >,
    nullptr
} };

void GalleryWidget::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    if (_c == QMetaObject::InvokeMetaMethod) {
        auto *_t = static_cast<GalleryWidget *>(_o);
        (void)_t;
        switch (_id) {
        case 0: _t->imageSelected((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1]))); break;
        case 1: _t->imagesSelected((*reinterpret_cast< std::add_pointer_t<QStringList>>(_a[1]))); break;
        case 2: _t->onImagesFetched((*reinterpret_cast< std::add_pointer_t<QJsonArray>>(_a[1])),(*reinterpret_cast< std::add_pointer_t<qint64>>(_a[2]))); break;
        case 3: _t->onFetchError((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1]))); break;
        case 4: _t->onThumbnailClicked((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1]))); break;
        case 5: _t->onSelectAll(); break;
        case 6: _t->onDeselectAll(); break;
        case 7: _t->onBatchDownload(); break;
        case 8: _t->onBatchShare(); break;
        case 9: _t->onBatchPrint(); break;
        case 10: _t->onBatchCopyUrl(); break;
        case 11: _t->loadMore(); break;
        default: ;
        }
    } else if (_c == QMetaObject::IndexOfMethod) {
        int *result = reinterpret_cast<int *>(_a[0]);
        {
            using _t = void (GalleryWidget::*)(const QString & );
            if (_t _q_method = &GalleryWidget::imageSelected; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 0;
                return;
            }
        }
        {
            using _t = void (GalleryWidget::*)(const QStringList & );
            if (_t _q_method = &GalleryWidget::imagesSelected; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 1;
                return;
            }
        }
    }
}

const QMetaObject *GalleryWidget::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *GalleryWidget::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_meta_stringdata_CLASSGalleryWidgetENDCLASS.stringdata0))
        return static_cast<void*>(this);
    return QWidget::qt_metacast(_clname);
}

int GalleryWidget::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QWidget::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        if (_id < 12)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 12;
    } else if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        if (_id < 12)
            *reinterpret_cast<QMetaType *>(_a[0]) = QMetaType();
        _id -= 12;
    }
    return _id;
}

// SIGNAL 0
void GalleryWidget::imageSelected(const QString & _t1)
{
    void *_a[] = { nullptr, const_cast<void*>(reinterpret_cast<const void*>(std::addressof(_t1))) };
    QMetaObject::activate(this, &staticMetaObject, 0, _a);
}

// SIGNAL 1
void GalleryWidget::imagesSelected(const QStringList & _t1)
{
    void *_a[] = { nullptr, const_cast<void*>(reinterpret_cast<const void*>(std::addressof(_t1))) };
    QMetaObject::activate(this, &staticMetaObject, 1, _a);
}
QT_WARNING_POP
