package com.mrcwoods.memories;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.pdf.PdfDocument;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;

import java.io.FileOutputStream;

public class BitmapPrintAdapter extends PrintDocumentAdapter {
    private final Bitmap bitmap;
    private final String jobName;

    public BitmapPrintAdapter(Bitmap bitmap, String jobName) {
        this.bitmap = bitmap;
        this.jobName = jobName;
    }

    @Override
    public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancellationSignal, LayoutResultCallback callback, android.os.Bundle extras) {
        if (cancellationSignal.isCanceled()) {
            callback.onLayoutCancelled();
            return;
        }
        PrintDocumentInfo info = new PrintDocumentInfo.Builder(jobName + ".pdf")
                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                .setPageCount(1)
                .build();
        callback.onLayoutFinished(info, true);
    }

    @Override
    public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancellationSignal, WriteResultCallback callback) {
        PdfDocument document = new PdfDocument();
        PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(595, 842, 1).create();
        PdfDocument.Page page = document.startPage(pageInfo);
        Canvas canvas = page.getCanvas();
        canvas.drawColor(Color.WHITE);
        float scale = Math.min(555f / bitmap.getWidth(), 802f / bitmap.getHeight());
        float left = (595f - bitmap.getWidth() * scale) / 2f;
        float top = (842f - bitmap.getHeight() * scale) / 2f;
        canvas.save();
        canvas.translate(left, top);
        canvas.scale(scale, scale);
        canvas.drawBitmap(bitmap, 0, 0, null);
        canvas.restore();
        document.finishPage(page);
        try (FileOutputStream output = new FileOutputStream(destination.getFileDescriptor())) {
            document.writeTo(output);
            callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
        } catch (Exception exception) {
            callback.onWriteFailed(exception.getMessage());
        } finally {
            document.close();
        }
    }
}
