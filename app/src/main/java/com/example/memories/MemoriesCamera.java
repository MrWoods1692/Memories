package com.example.memories;

import android.content.Context;
import android.graphics.ImageFormat;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Log;
import android.util.Size;
import android.view.Surface;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 远程摄像头管理器。
 * 支持：
 * 1. 拍照（snapshot）- 单张 JPEG 照片
 * 2. MJPEG 流（stream）- 连续帧流，用于实时预览
 * 3. 摄像头信息查询
 *
 * 使用 Camera2 API，自动选择后置摄像头。
 */
public class MemoriesCamera {
    private static final String TAG = "MemoriesCamera";
    private final Context context;
    private final CameraManager systemCameraManager;
    private final HandlerThread cameraThread;
    private final Handler cameraHandler;

    private CameraDevice cameraDevice;
    private CaptureRequest.Builder previewBuilder;
    private String cameraId;
    private Size previewSize;
    private boolean isOpen = false;

    // MJPEG 流相关
    private final AtomicBoolean streaming = new AtomicBoolean(false);
    private final List<OutputStream> streamClients = Collections.synchronizedList(new ArrayList<>());
    private ImageReader streamImageReader;

    public MemoriesCamera(Context ctx) {
        this.context = ctx.getApplicationContext();
        this.systemCameraManager = (CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
        this.cameraThread = new HandlerThread("CameraThread");
        this.cameraThread.start();
        this.cameraHandler = new Handler(cameraThread.getLooper());
    }

    /**
     * 获取摄像头列表信息（JSON 格式）
     */
    public String getCameraInfoJson() {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"cameras\":[");
        boolean first = true;
        try {
            for (String id : systemCameraManager.getCameraIdList()) {
                CameraCharacteristics chars = systemCameraManager.getCameraCharacteristics(id);
                Integer facing = chars.get(CameraCharacteristics.LENS_FACING);
                if (facing == null) continue;

                if (!first) sb.append(",");
                first = false;

                String facingStr = facing == CameraCharacteristics.LENS_FACING_BACK ? "后置" :
                        facing == CameraCharacteristics.LENS_FACING_FRONT ? "前置" : "外置";

                StreamConfigurationMap map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
                Size[] jpegSizes = map != null ? map.getOutputSizes(ImageFormat.JPEG) : new Size[0];
                Size bestSize = jpegSizes.length > 0 ? jpegSizes[0] : new Size(0, 0);

                sb.append("{");
                sb.append("\"id\":\"").append(id).append("\",");
                sb.append("\"facing\":\"").append(facingStr).append("\",");
                sb.append("\"maxJpegWidth\":").append(bestSize.getWidth()).append(",");
                sb.append("\"maxJpegHeight\":").append(bestSize.getHeight());
                sb.append("}");
            }
        } catch (Exception e) {
            Log.e(TAG, "getCameraInfo error", e);
        }
        sb.append("]}");
        return sb.toString();
    }

    /**
     * 拍摄单张照片，返回 JPEG 数据。
     */
    public byte[] takeSnapshot(int quality, int maxWidth) {
        if (cameraId == null) {
            try { openCamera(); } catch (Exception e) {
                Log.e(TAG, "Failed to open camera", e);
                return null;
            }
        }
        try {
            CameraCharacteristics chars = systemCameraManager.getCameraCharacteristics(cameraId);
            StreamConfigurationMap map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            Size[] yuvSizes = map.getOutputSizes(ImageFormat.YUV_420_888);
            Size captureSize = chooseBestSize(yuvSizes, maxWidth > 0 ? maxWidth : 1920);

            final ImageReader yuvReader = ImageReader.newInstance(
                    captureSize.getWidth(), captureSize.getHeight(), ImageFormat.YUV_420_888, 1);
            final CountDownLatch latch = new CountDownLatch(1);
            final AtomicReference<byte[]> result = new AtomicReference<>(null);

            yuvReader.setOnImageAvailableListener(reader -> {
                Image image = reader.acquireLatestImage();
                if (image != null) {
                    try {
                        ByteBuffer yBuffer = image.getPlanes()[0].getBuffer();
                        ByteBuffer uBuffer = image.getPlanes()[1].getBuffer();
                        ByteBuffer vBuffer = image.getPlanes()[2].getBuffer();
                        int ySize = yBuffer.remaining();
                        int uSize = uBuffer.remaining();
                        int vSize = vBuffer.remaining();
                        byte[] nv21 = new byte[ySize + uSize + vSize];
                        yBuffer.get(nv21, 0, ySize);
                        vBuffer.get(nv21, ySize, vSize);
                        uBuffer.get(nv21, ySize + vSize, uSize);
                        YuvImage yuvImage = new YuvImage(nv21, ImageFormat.NV21,
                                image.getWidth(), image.getHeight(), null);
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        yuvImage.compressToJpeg(new Rect(0, 0, image.getWidth(), image.getHeight()),
                                quality, baos);
                        result.set(baos.toByteArray());
                    } catch (Exception e) {
                        Log.e(TAG, "YUV->JPEG error", e);
                    } finally { image.close(); }
                }
                latch.countDown();
            }, cameraHandler);

            openCameraInternal(yuvReader.getSurface(), captureSize.getWidth(), captureSize.getHeight());
            latch.await(5, TimeUnit.SECONDS);
            closeCamera();
            return result.get();
        } catch (Exception e) {
            Log.e(TAG, "takeSnapshot error", e);
            closeCamera();
            return null;
        }
    }

    /**
     * 开始 MJPEG 流式传输。
     */
    public void startMjpegStream(final OutputStream output, int quality, int maxWidth) {
        streamClients.add(output);
        if (streaming.getAndSet(true)) return;

        try {
            if (cameraId == null) openCamera();
            CameraCharacteristics chars = systemCameraManager.getCameraCharacteristics(cameraId);
            StreamConfigurationMap map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            Size[] sizes = map.getOutputSizes(ImageFormat.YUV_420_888);
            previewSize = chooseBestSize(sizes, maxWidth > 0 ? maxWidth : 640);

            streamImageReader = ImageReader.newInstance(
                    previewSize.getWidth(), previewSize.getHeight(), ImageFormat.YUV_420_888, 2);

            streamImageReader.setOnImageAvailableListener(reader -> {
                if (!streaming.get() || streamClients.isEmpty()) return;
                Image image = reader.acquireLatestImage();
                if (image == null) return;
                try {
                    ByteBuffer yBuffer = image.getPlanes()[0].getBuffer();
                    ByteBuffer uBuffer = image.getPlanes()[1].getBuffer();
                    ByteBuffer vBuffer = image.getPlanes()[2].getBuffer();
                    int ySize = yBuffer.remaining();
                    int uSize = uBuffer.remaining();
                    int vSize = vBuffer.remaining();
                    byte[] nv21 = new byte[ySize + uSize + vSize];
                    yBuffer.get(nv21, 0, ySize);
                    vBuffer.get(nv21, ySize, vSize);
                    uBuffer.get(nv21, ySize + vSize, uSize);
                    YuvImage yuvImage = new YuvImage(nv21, ImageFormat.NV21,
                            image.getWidth(), image.getHeight(), null);
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    yuvImage.compressToJpeg(new Rect(0, 0, image.getWidth(), image.getHeight()),
                            quality, baos);
                    byte[] jpegData = baos.toByteArray();

                    String header = "--mjpeg\r\nContent-Type: image/jpeg\r\nContent-Length: "
                            + jpegData.length + "\r\n\r\n";
                    byte[] headerBytes = header.getBytes("UTF-8");

                    synchronized (streamClients) {
                        List<OutputStream> dead = new ArrayList<>();
                        for (OutputStream client : streamClients) {
                            try {
                                client.write(headerBytes);
                                client.write(jpegData);
                                client.write("\r\n".getBytes("UTF-8"));
                                client.flush();
                            } catch (Exception e) { dead.add(client); }
                        }
                        streamClients.removeAll(dead);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "MJPEG frame error", e);
                } finally { image.close(); }
                if (streamClients.isEmpty()) stopMjpegStream();
            }, cameraHandler);

            openCameraInternal(streamImageReader.getSurface(),
                    previewSize.getWidth(), previewSize.getHeight());
        } catch (Exception e) {
            Log.e(TAG, "startMjpegStream error", e);
            streaming.set(false);
        }
    }

    public void stopMjpegStream() {
        streaming.set(false);
        streamClients.clear();
        closeCamera();
    }

    public boolean isStreaming() {
        return streaming.get();
    }

    public boolean hasStreamClient(OutputStream client) {
        return streamClients.contains(client);
    }

    public void removeStreamClient(OutputStream client) {
        streamClients.remove(client);
        if (streamClients.isEmpty()) stopMjpegStream();
    }

    private void openCamera() throws Exception {
        if (cameraId == null) {
            for (String id : systemCameraManager.getCameraIdList()) {
                CameraCharacteristics chars = systemCameraManager.getCameraCharacteristics(id);
                Integer facing = chars.get(CameraCharacteristics.LENS_FACING);
                if (facing != null && facing == CameraCharacteristics.LENS_FACING_BACK) {
                    cameraId = id;
                    return;
                }
            }
            String[] ids = systemCameraManager.getCameraIdList();
            if (ids.length > 0) cameraId = ids[0];
        }
    }

    private void openCameraInternal(Surface targetSurface, int width, int height) {
        if (isOpen) return;
        try {
            if (cameraId == null) openCamera();
            if (context.checkSelfPermission(android.Manifest.permission.CAMERA)
                    != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "Camera permission not granted");
                return;
            }
            final CountDownLatch openLatch = new CountDownLatch(1);
            systemCameraManager.openCamera(cameraId, new CameraDevice.StateCallback() {
                @Override
                public void onOpened(CameraDevice camera) {
                    cameraDevice = camera;
                    try {
                        previewBuilder = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
                        previewBuilder.addTarget(targetSurface);
                        camera.createCaptureSession(Collections.singletonList(targetSurface),
                            new CameraCaptureSession.StateCallback() {
                                @Override
                                public void onConfigured(CameraCaptureSession session) {
                                    try {
                                        session.setRepeatingRequest(
                                                previewBuilder.build(), null, cameraHandler);
                                        isOpen = true;
                                    } catch (CameraAccessException e) {
                                        Log.e(TAG, "setRepeatingRequest error", e);
                                    }
                                    openLatch.countDown();
                                }
                                @Override
                                public void onConfigureFailed(CameraCaptureSession s) {
                                    Log.e(TAG, "CaptureSession config failed");
                                    openLatch.countDown();
                                }
                            }, cameraHandler);
                    } catch (CameraAccessException e) {
                        Log.e(TAG, "createCaptureSession error", e);
                        openLatch.countDown();
                    }
                }
                @Override
                public void onDisconnected(CameraDevice camera) {
                    camera.close(); cameraDevice = null; isOpen = false;
                    openLatch.countDown();
                }
                @Override
                public void onError(CameraDevice camera, int error) {
                    camera.close(); cameraDevice = null; isOpen = false;
                    openLatch.countDown();
                }
            }, cameraHandler);
            openLatch.await(3, TimeUnit.SECONDS);
        } catch (Exception e) {
            Log.e(TAG, "openCameraInternal error", e);
        }
    }

    public void closeCamera() {
        isOpen = false;
        if (cameraDevice != null) { cameraDevice.close(); cameraDevice = null; }
    }

    private Size chooseBestSize(Size[] sizes, int targetWidth) {
        if (sizes == null || sizes.length == 0) return new Size(640, 480);
        Size best = sizes[0];
        int bestDiff = Math.abs(best.getWidth() - targetWidth);
        for (Size s : sizes) {
            int diff = Math.abs(s.getWidth() - targetWidth);
            if (diff < bestDiff) { bestDiff = diff; best = s; }
        }
        return best;
    }

    public void release() {
        stopMjpegStream();
        closeCamera();
        cameraThread.quitSafely();
    }
}
