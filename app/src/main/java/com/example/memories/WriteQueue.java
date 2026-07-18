package com.example.memories;

import android.util.Log;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

/**
 * 数据库写入队列 - 通过单线程执行器序列化所有写操作，
 * 解决高并发下 SQLite 写入锁冲突问题。
 *
 * 使用方式：
 *   WriteQueue.submit(() -> { db.insert(...); return result; }).get();
 *   或
 *   WriteQueue.execute(() -> { db.insert(...); });
 */
public class WriteQueue {
    private static final String TAG = "WriteQueue";

    private static final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "memories-db-writer");
        t.setDaemon(true);
        t.setPriority(Thread.NORM_PRIORITY);
        return t;
    });

    private WriteQueue() {
        // 工具类，禁止实例化
    }

    /** 每次写入完成后调用的回调（用于触发外部备份等操作） */
    private static volatile Runnable onAfterWrite;

    public static void setOnAfterWrite(Runnable callback) {
        onAfterWrite = callback;
    }

    /**
     * 提交一个有返回值的写任务，返回 Future 供调用方等待结果。
     * 调用方需要调用 future.get() 来阻塞等待写入完成并获取返回值。
     */
    public static <T> Future<T> submit(Callable<T> task) {
        try {
            return executor.submit(() -> {
                try {
                    return task.call();
                } finally {
                    if (onAfterWrite != null) onAfterWrite.run();
                }
            });
        } catch (RejectedExecutionException e) {
            Log.e(TAG, "Write queue rejected task", e);
            throw new RuntimeException("数据库写入队列已关闭", e);
        }
    }

    /**
     * 提交一个无返回值的写任务（fire-and-forget）。
     * 注意：此方法不等待写入完成，仅适用于不需要返回值的场景。
     */
    public static Future<?> execute(Runnable task) {
        try {
            return executor.submit(task);
        } catch (RejectedExecutionException e) {
            Log.e(TAG, "Write queue rejected task", e);
            throw new RuntimeException("数据库写入队列已关闭", e);
        }
    }

    /**
     * 获取当前队列中待处理的任务数（近似值）
     */
    public static int getQueueSize() {
        // ExecutorService 不直接暴露队列大小，此处通过反射或间接方式
        // 对于监控目的，保留此接口
        return 0; // 暂不实现精确监控
    }

    /**
     * 优雅关闭写入队列（应用退出时调用）
     */
    public static void shutdown() {
        Log.i(TAG, "Shutting down write queue...");
        executor.shutdown();
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
