#include "models/UploadQueue.h"

UploadQueue::UploadQueue(QObject* parent) : QObject(parent) {}

void UploadQueue::enqueue(const UploadItem& item) {
    QMutexLocker lock(&m_mutex);
    m_items.append(item);
    emit queueChanged();
}

void UploadQueue::enqueueBatch(const QList<UploadItem>& items) {
    QMutexLocker lock(&m_mutex);
    m_items.append(items);
    emit queueChanged();
}

void UploadQueue::dequeue(int index) {
    QMutexLocker lock(&m_mutex);
    if (index >= 0 && index < m_items.size()) {
        m_items.removeAt(index);
        if (m_currentIndex >= m_items.size())
            m_currentIndex = m_items.size() - 1;
        emit queueChanged();
    }
}

void UploadQueue::clear() {
    QMutexLocker lock(&m_mutex);
    m_items.clear();
    m_currentIndex = -1;
    emit queueChanged();
}

void UploadQueue::clearCompleted() {
    QMutexLocker lock(&m_mutex);
    m_items.erase(
        std::remove_if(m_items.begin(), m_items.end(),
            [](const UploadItem& i) { return i.state == UploadState::Completed; }),
        m_items.end()
    );
    emit queueChanged();
}

int UploadQueue::count() const { QMutexLocker lock(&m_mutex); return m_items.size(); }

int UploadQueue::pendingCount() const {
    QMutexLocker lock(&m_mutex);
    return std::count_if(m_items.begin(), m_items.end(),
        [](const UploadItem& i) { return i.state == UploadState::Pending; });
}

int UploadQueue::completedCount() const {
    QMutexLocker lock(&m_mutex);
    return std::count_if(m_items.begin(), m_items.end(),
        [](const UploadItem& i) { return i.state == UploadState::Completed; });
}

int UploadQueue::failedCount() const {
    QMutexLocker lock(&m_mutex);
    return std::count_if(m_items.begin(), m_items.end(),
        [](const UploadItem& i) { return i.state == UploadState::Failed; });
}

const QList<UploadItem>& UploadQueue::items() const { return m_items; }

UploadItem* UploadQueue::currentItem() {
    if (m_currentIndex >= 0 && m_currentIndex < m_items.size())
        return &m_items[m_currentIndex];
    return nullptr;
}

const UploadItem* UploadQueue::currentItem() const {
    return const_cast<UploadQueue*>(this)->currentItem();
}

void UploadQueue::setCurrentIndex(int index) { m_currentIndex = index; }
int UploadQueue::currentIndex() const { return m_currentIndex; }
