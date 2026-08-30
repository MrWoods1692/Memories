import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App, Button, Card, Image as AntImage, Input, Modal, Pagination, Segmented, Select, Space, Spin, Table, Tag, Tooltip, Typography,
} from "antd";
import {
  EditOutlined, ReloadOutlined, FileTextOutlined, TagsOutlined,
} from "@ant-design/icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { fetchImages, fetchImagesByStatus, updateImageMeta, parseImageTags } from "@/api";
import type { ImageItem } from "@/types";

const { Text } = Typography;

const PAGE_SIZE = 20;

/** 移动端断点：宽度 < 640px 时表格列放不下，改用卡片式列表 */
const MOBILE_BREAKPOINT = 640;

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

type AdminImagesTab = "approved" | "pending" | "rejected";

const TAB_LABELS: Record<AdminImagesTab, string> = { approved: "已通过", pending: "待审核", rejected: "未通过" };

/**
 * 管理后台「图片管理」：查看图片列表，修改标签与描述。
 * 权限：审核员及以上可修改标签，管理员可修改描述（服务端同样校验）。
 * 桌面端表格、移动端（<640px）卡片式列表，避免长 URL 与多列挤压换行。
 */
export default function AdminImages() {
  const { message } = App.useApp();
  const { accentColor } = useTheme();
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const isMobile = useIsMobile();

  const [tab, setTab] = useState<AdminImagesTab>("approved");
  const [items, setItems] = useState<ImageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // 编辑弹窗状态
  const [editing, setEditing] = useState<ImageItem | null>(null);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftDesc, setDraftDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      let res;
      if (tab === "approved") res = await fetchImages(p, PAGE_SIZE, true);
      else res = await fetchImagesByStatus(tab, p, PAGE_SIZE);
      setItems(Array.isArray(res.items) ? res.items : []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      setPage(res.page || p);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [tab, message]);

  useEffect(() => { load(1); }, [load]);

  const allTags = useMemo(
    () => Array.from(new Set(items.flatMap((i) => parseImageTags(i.tags)))),
    [items]
  );

  const tableParam = tab === "approved" ? "approved" : tab;

  const openEdit = (img: ImageItem) => {
    setEditing(img);
    setDraftTags(parseImageTags(img.tags));
    setDraftDesc(img.description || "");
  };

  const saveMeta = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateImageMeta(editing.url, {
        tags: draftTags,
        description: isAdmin ? draftDesc : undefined,
        table: tableParam,
      });
      message.success("已保存");
      setEditing(null);
      load(page);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: "图片",
      dataIndex: "url",
      key: "url",
      width: 92,
      render: (url: string) => (
        <AntImage src={url} width={72} height={54} style={{ objectFit: "cover", borderRadius: 8 }} fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzIiIGhlaWdodD0iNTQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjcyIiBoZWlnaHQ9IjU0IiBmaWxsPSIjZWVlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjEwIj7lm77niYfliKnlip88L3RleHQ+PC9zdmc+" />
      ),
    },
    {
      title: "URL",
      dataIndex: "url",
      key: "urlText",
      ellipsis: true,
      render: (url: string) => <Text copyable style={{ fontSize: 12 }}>{url}</Text>,
    },
    {
      title: "标签",
      dataIndex: "tags",
      key: "tags",
      width: 180,
      render: (_: unknown, record: ImageItem) => {
        const t = parseImageTags(record.tags);
        if (t.length === 0) return <Text type="secondary" style={{ fontSize: 12 }}>无</Text>;
        return (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {t.slice(0, 4).map((x) => <Tag key={x} color="blue" style={{ borderRadius: 6, fontSize: 11, margin: 0 }}>{x}</Tag>)}
          </div>
        );
      },
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (desc: string) => desc
        ? <Text style={{ fontSize: 12 }}>{desc}</Text>
        : <Text type="secondary" style={{ fontSize: 12 }}>无</Text>,
    },
    {
      title: "上传者 QQ",
      dataIndex: "qq",
      key: "qq",
      width: 110,
      render: (qq: string) => qq ? <Text style={{ fontSize: 12 }}>{qq}</Text> : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: "时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 150,
      render: (ts: number) => <Text style={{ fontSize: 12 }}>{ts ? new Date(ts).toLocaleString("zh-CN") : "-"}</Text>,
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      render: (_: unknown, record: ImageItem) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} style={{ borderRadius: 8 }}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <Card size="small" style={{ borderRadius: 14 }} styles={{ body: { padding: "12px 16px" } }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <Space size={8}>
          <Segmented
            size="small"
            value={tab}
            onChange={(v) => { setTab(v as AdminImagesTab); setPage(1); }}
            options={[
              { value: "approved", label: "已通过" },
              { value: "pending", label: "待审核" },
              ...(isAdmin ? [{ value: "rejected" as AdminImagesTab, label: "未通过" }] : []),
            ]}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>共 {total} 张</Text>
        </Space>
        <Space size={6}>
          <Tooltip title={isAdmin ? "审核员及以上可改标签，管理员可改描述" : "你有权修改标签；描述仅管理员可修改"}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {isAdmin ? <><TagsOutlined /> 标签 + <FileTextOutlined /> 描述</> : <><TagsOutlined /> 标签</>}
            </Text>
          </Tooltip>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => load(page)} style={{ borderRadius: 8 }}>刷新</Button>
        </Space>
      </div>

      <Table
        rowKey="url"
        size="small"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          onChange: (p) => { setPage(p); load(p); },
          showSizeChanger: false,
          size: "small",
        }}
        locale={{ emptyText: "该状态下暂无图片" }}
      />

      {/* 移动端卡片列表：缩略图 + 标签 + 描述 + QQ + 时间，编辑入口常驻 */}
      {isMobile && (loading ? (
        <div style={{ textAlign: "center", padding: 32 }}><Spin /></div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32 }}>
          <Text type="secondary">该状态下暂无图片</Text>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {items.map((img) => {
            const t = parseImageTags(img.tags);
            return (
              <Card key={img.url} size="small" style={{ borderRadius: 12 }} styles={{ body: { padding: "10px 12px" } }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <AntImage src={img.url} width={64} height={48} style={{ objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                    preview={false}
                    fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjZWVlIi8+PC9zdmc+" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text copyable style={{ fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {img.url}
                    </Text>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                      {t.length > 0
                        ? t.slice(0, 3).map((x) => <Tag key={x} color="blue" style={{ borderRadius: 6, fontSize: 10, margin: 0, lineHeight: "18px" }}>{x}</Tag>)
                        : <Text type="secondary" style={{ fontSize: 11 }}>无标签</Text>}
                    </div>
                    {img.description && (
                      <Text style={{ fontSize: 11, display: "block", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {img.description}
                      </Text>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>{img.qq || "—"}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {img.created_at ? new Date(img.created_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                      </Text>
                    </div>
                  </div>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(img)} style={{ borderRadius: 8, flexShrink: 0 }} />
                </div>
              </Card>
            );
          })}
          {items.length > 0 && totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
              <Pagination
                simple
                size="small"
                current={page}
                pageSize={PAGE_SIZE}
                total={total}
                onChange={(p) => { setPage(p); load(p); }}
              />
            </div>
          )}
        </div>
      ))}

      <Modal
        title={<span style={{ color: accentColor, fontWeight: 700 }}>编辑图片信息</span>}
        open={!!editing}
        onOk={saveMeta}
        onCancel={() => setEditing(null)}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        width={isMobile ? "100%" : 520}
        style={isMobile ? { maxWidth: "100vw", margin: 0, padding: 0, top: 0 } : undefined}
        styles={{ body: { maxHeight: "80vh", overflowY: "auto" } }}
        destroyOnClose
      >
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AntImage src={editing.url} width={64} height={48} style={{ objectFit: "cover", borderRadius: 8 }} preview={false}
                fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjZWVlIi8+PC9zdmc+" />
              <Text style={{ fontSize: 12, wordBreak: "break-all" }}>{editing.url}</Text>
            </div>
            <div>
              <Text style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                <TagsOutlined style={{ marginRight: 4, color: accentColor }} />标签（审核员及以上可修改）
              </Text>
              <Select
                mode="tags"
                style={{ width: "100%" }}
                placeholder="输入标签后回车"
                value={draftTags}
                onChange={(v: string[]) => setDraftTags(v)}
                options={allTags.map((t) => ({ value: t, label: t }))}
              />
            </div>
            <div>
              <Text style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                <FileTextOutlined style={{ marginRight: 4, color: accentColor }} />描述（仅管理员可修改）
              </Text>
              <Input.TextArea
                rows={3}
                placeholder="图片描述"
                value={draftDesc}
                disabled={!isAdmin}
                onChange={(e) => setDraftDesc(e.target.value)}
                maxLength={300}
                showCount
              />
              {!isAdmin && (
                <Text type="secondary" style={{ fontSize: 12 }}>你是审核员，描述仅管理员可修改，此项将不会提交。</Text>
              )}
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
