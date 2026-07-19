package com.mrcwoods.memories;

public class ImageItem {
    public long id;
    public String url;
    public int status;
    public long uploadedAt;

    public ImageItem(long id, String url, int status, long uploadedAt) {
        this.id = id;
        this.url = url;
        this.status = status;
        this.uploadedAt = uploadedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ImageItem imageItem = (ImageItem) o;
        return id == imageItem.id;
    }

    @Override
    public int hashCode() {
        return Long.hashCode(id);
    }
}