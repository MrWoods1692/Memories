/****************************************************************************
** Meta object code from reading C++ file 'UploadDialog.h'
**
** Created by: The Qt Meta Object Compiler version 68 (Qt 6.8.0)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "../../../src/ui/UploadDialog.h"
#include <QtGui/qtextcursor.h>
#include <QtCore/qmetatype.h>

#include <QtCore/qtmochelpers.h>

#include <memory>


#include <QtCore/qxptype_traits.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'UploadDialog.h' doesn't include <QObject>."
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
struct qt_meta_stringdata_CLASSUploadDialogENDCLASS_t {};
constexpr auto qt_meta_stringdata_CLASSUploadDialogENDCLASS = QtMocHelpers::stringData(
    "UploadDialog",
    "onSelectFiles",
    "",
    "onSelectFolder",
    "onStartUpload",
    "onCancelUpload",
    "onClearCompleted",
    "onClearAll",
    "onItemProgress",
    "index",
    "progress",
    "onItemStateChanged",
    "UploadState",
    "state",
    "onUploadCompleted",
    "UploadItem",
    "item",
    "onUploadFailed",
    "path",
    "error",
    "onAllCompleted"
);
#else  // !QT_MOC_HAS_STRINGDATA
#error "qtmochelpers.h not found or too old."
#endif // !QT_MOC_HAS_STRINGDATA
} // unnamed namespace

Q_CONSTINIT static const uint qt_meta_data_CLASSUploadDialogENDCLASS[] = {

 // content:
      12,       // revision
       0,       // classname
       0,    0, // classinfo
      11,   14, // methods
       0,    0, // properties
       0,    0, // enums/sets
       0,    0, // constructors
       0,       // flags
       0,       // signalCount

 // slots: name, argc, parameters, tag, flags, initial metatype offsets
       1,    0,   80,    2, 0x08,    1 /* Private */,
       3,    0,   81,    2, 0x08,    2 /* Private */,
       4,    0,   82,    2, 0x08,    3 /* Private */,
       5,    0,   83,    2, 0x08,    4 /* Private */,
       6,    0,   84,    2, 0x08,    5 /* Private */,
       7,    0,   85,    2, 0x08,    6 /* Private */,
       8,    2,   86,    2, 0x08,    7 /* Private */,
      11,    2,   91,    2, 0x08,   10 /* Private */,
      14,    1,   96,    2, 0x08,   13 /* Private */,
      17,    2,   99,    2, 0x08,   15 /* Private */,
      20,    0,  104,    2, 0x08,   18 /* Private */,

 // slots: parameters
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void, QMetaType::Int, QMetaType::Int,    9,   10,
    QMetaType::Void, QMetaType::Int, 0x80000000 | 12,    9,   13,
    QMetaType::Void, 0x80000000 | 15,   16,
    QMetaType::Void, QMetaType::QString, QMetaType::QString,   18,   19,
    QMetaType::Void,

       0        // eod
};

Q_CONSTINIT const QMetaObject UploadDialog::staticMetaObject = { {
    QMetaObject::SuperData::link<QDialog::staticMetaObject>(),
    qt_meta_stringdata_CLASSUploadDialogENDCLASS.offsetsAndSizes,
    qt_meta_data_CLASSUploadDialogENDCLASS,
    qt_static_metacall,
    nullptr,
    qt_incomplete_metaTypeArray<qt_meta_stringdata_CLASSUploadDialogENDCLASS_t,
        // Q_OBJECT / Q_GADGET
        QtPrivate::TypeAndForceComplete<UploadDialog, std::true_type>,
        // method 'onSelectFiles'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'onSelectFolder'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'onStartUpload'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'onCancelUpload'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'onClearCompleted'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'onClearAll'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'onItemProgress'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<int, std::false_type>,
        QtPrivate::TypeAndForceComplete<int, std::false_type>,
        // method 'onItemStateChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<int, std::false_type>,
        QtPrivate::TypeAndForceComplete<UploadState, std::false_type>,
        // method 'onUploadCompleted'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<const UploadItem &, std::false_type>,
        // method 'onUploadFailed'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QString &, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QString &, std::false_type>,
        // method 'onAllCompleted'
        QtPrivate::TypeAndForceComplete<void, std::false_type>
    >,
    nullptr
} };

void UploadDialog::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    if (_c == QMetaObject::InvokeMetaMethod) {
        auto *_t = static_cast<UploadDialog *>(_o);
        (void)_t;
        switch (_id) {
        case 0: _t->onSelectFiles(); break;
        case 1: _t->onSelectFolder(); break;
        case 2: _t->onStartUpload(); break;
        case 3: _t->onCancelUpload(); break;
        case 4: _t->onClearCompleted(); break;
        case 5: _t->onClearAll(); break;
        case 6: _t->onItemProgress((*reinterpret_cast< std::add_pointer_t<int>>(_a[1])),(*reinterpret_cast< std::add_pointer_t<int>>(_a[2]))); break;
        case 7: _t->onItemStateChanged((*reinterpret_cast< std::add_pointer_t<int>>(_a[1])),(*reinterpret_cast< std::add_pointer_t<UploadState>>(_a[2]))); break;
        case 8: _t->onUploadCompleted((*reinterpret_cast< std::add_pointer_t<UploadItem>>(_a[1]))); break;
        case 9: _t->onUploadFailed((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1])),(*reinterpret_cast< std::add_pointer_t<QString>>(_a[2]))); break;
        case 10: _t->onAllCompleted(); break;
        default: ;
        }
    }
}

const QMetaObject *UploadDialog::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *UploadDialog::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_meta_stringdata_CLASSUploadDialogENDCLASS.stringdata0))
        return static_cast<void*>(this);
    return QDialog::qt_metacast(_clname);
}

int UploadDialog::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QDialog::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        if (_id < 11)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 11;
    } else if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        if (_id < 11)
            *reinterpret_cast<QMetaType *>(_a[0]) = QMetaType();
        _id -= 11;
    }
    return _id;
}
QT_WARNING_POP
