import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App, Badge, Button, Card, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Tooltip, Typography,
} from "antd";
import {
  EyeOutlined, MonitorOutlined, ReloadOutlined, SafetyCertificateOutlined, PictureOutlined,
  StopOutlined, TeamOutlined, UndoOutlined, UserAddOutlined, UserDeleteOutlined,
} from "@ant-design/icons";
import { useTheme } from "@/contexts/ThemeContext";
import { theme } from "antd";
import { useAuth } from "@/contexts/AuthContext";
import {
  addAdminUser, banAdminUser, fetchAdminBans, fetchAdminUsers,
  removeAdminUser, unbanAdminUser,
} from "@/api/admin";
import type { AdminBan, AdminUser } from "@/types";
import { AdminSystemInfo } from "@/pages/AdminSystemInfo";
import AdminImages from "@/pages/AdminImages";

const { Title, Text } = Typography;

const roleOptions = [
  { value: 1, label: "审核员" },
  { value: 2, label: "管理员" },
];

const roleLabel = (role: number) => (role === 2 ? "管理员" : "审核员");

/** 移动端判定：宽度小于 640px 时表格空间紧张，QQ 号文字无法横排显示 */
const MOBILE_BREAKPOINT = 640;

/** 监听视口宽度是否处于移动端区间（复用 AppLayout 的 resize 模式） */
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

/** QQ 圆形头像地址（腾讯 qlogo 服务，s=640 为原始尺寸） */
const qqAvatar = (qq: string) => `https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(String(qq))}&s=640`;

/** 加载失败（号码不存在或无头像）时显示的默认占位头像 */
const avatarFallback = qqAvatar("0");

/** 表格中显示的 QQ 圆形头像（边框与背景取当前主题 token，亮/暗色模式均适用） */
function QqAvatar({ qq }: { qq: string }) {
  const { token } = theme.useToken();
  return (
    <img
      src={qqAvatar(qq)}
      alt={qq}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = avatarFallback;
      }}
      style={{
        width: 32, height: 32, borderRadius: "50%",
        objectFit: "cover", flexShrink: 0,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
      }}
    />
  );
}

/** 后台页面：审核员及以上可见，管理图片标签/描述、审核员与管理员、封禁名单（用户与封禁仅管理员） */
export default function AdminPage() {
  const { message, modal } = App.useApp();
  const { accentColor } = useTheme();
  const { token } = theme.useToken();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [bans, setBans] = useState<AdminBan[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingBans, setLoadingBans] = useState(true);

  // 添加用户 / 封禁用户表单
  const [addOpen, setAddOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [addForm] = Form.useForm<{ qq: string; role: 1 | 2 }>();
  const [banForm] = Form.useForm<{ qq: string; reason: string }>();

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try { setUsers(await fetchAdminUsers()); }
    catch (err) { message.error(err instanceof Error ? err.message : "加载用户失败"); }
    finally { setLoadingUsers(false); }
  }, [message]);

  const loadBans = useCallback(async () => {
    setLoadingBans(true);
    try { setBans(await fetchAdminBans()); }
    catch (err) { message.error(err instanceof Error ? err.message : "加载封禁列表失败"); }
    finally { setLoadingBans(false); }
  }, [message]);

  useEffect(() => {
    loadUsers();
    loadBans();
  }, [loadUsers, loadBans]);

  // 添加审核员 / 管理员
  const handleAddUser = async () => {
    const values = await addForm.validateFields();
    try {
      await addAdminUser(values.qq, values.role);
      message.success("已添加");
      setAddOpen(false);
      addForm.resetFields();
      await loadUsers();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "添加失败");
    }
  };

  const handleRemoveUser = (target: AdminUser) => {
    const isSelf = String(target.qq) === String(user?.qq);
    // 移除管理员必须在内网管理页面操作：外网站点只允许移除审核员，避免管理员把自己或同伴踢下线
    if (target.role >= 2) {
      message.info("管理员的移除仅支持在内网管理页面操作");
      return;
    }
    modal.confirm({
      title: "移除权限",
      icon: <UserDeleteOutlined />,
      content: `确定要将 ${target.qq} 从${roleLabel(target.role)}列表中移除吗？`,
      okText: "移除",
      cancelText: "取消",
      okButtonProps: { danger: true, disabled: isSelf },
      onOk: async () => {
        try {
          await removeAdminUser(target.qq);
          message.success("已移除");
          await loadUsers();
        } catch (err) {
          message.error(err instanceof Error ? err.message : "移除失败");
        }
      },
    });
  };

  // 封禁用户
  const handleBanUser = async () => {
    const values = await banForm.validateFields();
    try {
      await banAdminUser(values.qq, values.reason || "未说明");
      message.success("已封禁");
      setBanOpen(false);
      banForm.resetFields();
      await loadBans();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "封禁失败");
    }
  };

  const handleUnbanUser = (qq: string) => {
    modal.confirm({
      title: "解封用户",
      icon: <UndoOutlined />,
      content: `确定要解封 ${qq} 吗？`,
      okText: "解封",
      cancelText: "取消",
      onOk: async () => {
        try {
          await unbanAdminUser(qq);
          message.success("已解封");
          await loadBans();
        } catch (err) {
          message.error(err instanceof Error ? err.message : "解封失败");
        }
      },
    });
  };

  const isAdminCount = useMemo(() => users.filter((u: AdminUser) => u.role === 2).length, [users]);
  const isReviewerCount = useMemo(() => users.filter((u: AdminUser) => u.role === 1).length, [users]);

  /** 移动端无法完整显示 QQ 号时的查看交互：优先复制到剪贴板，不支持或失败则弹窗显示 */
  const showQq = (qq: string) => {
    if (!navigator.clipboard) {
      modal.info({ title: "QQ 号", content: qq, okText: "知道了" });
      return;
    }
    navigator.clipboard.writeText(qq).then(() => {
      message.success(`已复制 QQ ${qq}`);
    }).catch(() => {
      modal.info({ title: "QQ 号", content: qq, okText: "知道了" });
    });
  };

  /** 移动端 QQ 号列：只显示头像 + 查看按钮，QQ 号文本不再占用列宽 */
  const renderMobileQq = (qq: string) => (
    <Space size="small" align="center">
      <QqAvatar qq={qq} />
      <Tooltip title={`查看 QQ ${qq}`}>
        <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => showQq(qq)} style={{ paddingInline: 6 }} />
      </Tooltip>
    </Space>
  );

  const userColumns = [
    {
      title: "QQ 号",
      dataIndex: "qq",
      key: "qq",
      render: (qq: string) => {
        // 移动端表格列宽不足，QQ 号会折断换行：只显示头像 + 查看按钮
        if (isMobile) {
          return (
            <Space size="small" align="center">
              {renderMobileQq(qq)}
              {String(qq) === String(user?.qq) && <Tag color="blue" style={{ margin: 0 }}>我</Tag>}
            </Space>
          );
        }
        return (
          <Space size="small" align="center">
            <QqAvatar qq={qq} />
            <Text style={{ fontWeight: 500 }}>{qq}</Text>
            {String(qq) === String(user?.qq) && <Tag color="blue" style={{ margin: 0 }}>我</Tag>}
          </Space>
        );
      },
    },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      width: 110,
      render: (role: number) => (
        <Tag color={role === 2 ? "warning" : "success"} style={{ borderRadius: 10, margin: 0, fontWeight: 500 }}>
          {role === 2 ? <SafetyCertificateOutlined style={{ marginRight: 4 }} /> : <TeamOutlined style={{ marginRight: 4 }} />}
          {roleLabel(role)}
        </Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_: unknown, record: AdminUser) => {
        const isSelf = String(record.qq) === String(user?.qq);
        const isProtectedAdmin = record.role >= 2;
        const tip = isSelf
          ? "不能移除自己的权限"
          : isProtectedAdmin
            ? "管理员的移除仅支持在内网管理页面操作"
            : "移除";
        return (
          <Tooltip title={tip}>
            <Button
              danger
              size="small"
              icon={<UserDeleteOutlined />}
              disabled={isSelf || isProtectedAdmin}
              onClick={() => handleRemoveUser(record)}
              style={{ borderRadius: 8 }}
            />
          </Tooltip>
        );
      },
    },
  ];

  const banColumns = [
    {
      title: "QQ 号",
      dataIndex: "qq",
      key: "qq",
      render: (qq: string) => isMobile ? (
        renderMobileQq(qq)
      ) : (
        <Space size="small" align="center"><QqAvatar qq={qq} /><Text style={{ fontWeight: 500 }}>{qq}</Text></Space>
      ),
    },
    {
      title: "原因",
      dataIndex: "reason",
      key: "reason",
      ellipsis: true,
      render: (reason: string) => reason || <Text type="secondary">未说明</Text>,
    },
    {
      title: "封禁时间",
      dataIndex: "banned_at",
      key: "banned_at",
      width: 160,
      render: (ts: number) => (ts ? new Date(ts).toLocaleString("zh-CN") : "-"),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_: unknown, record: AdminBan) => (
        <Button type="primary" size="small" icon={<UndoOutlined />}
          onClick={() => handleUnbanUser(record.qq)} style={{ borderRadius: 8 }}>解封</Button>
      ),
    },
  ];

  return (
    <div className="fade-in-up" style={{ padding: "0 0 24px" }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 4, flexWrap: "wrap", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }} >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}11 100%)`,
              border: `1px solid ${accentColor}30`,
              boxShadow: `0 2px 8px ${accentColor}18`,
            }}>
              <SafetyCertificateOutlined style={{ fontSize: 20, color: accentColor }} />
            </div>
            <div>
              <Title level={3} style={{ margin: 0, fontWeight: 700, color: accentColor, fontSize: 22 }}>
                管理后台
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                图片标签与描述、审核员与管理员、封禁名单
              </Text>
            </div>
          </div>
          <Space size="small" wrap>
            {user?.is_admin && (
              <>
            <Button icon={<ReloadOutlined />} onClick={() => { loadUsers(); loadBans(); }}
              style={{ borderRadius: 10 }}>刷新</Button>
            <Button icon={<StopOutlined />} onClick={() => setBanOpen(true)} style={{ borderRadius: 10 }}>
              封禁用户
            </Button>
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => setAddOpen(true)}
              style={{
                borderRadius: 10, fontWeight: 600,
                background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}CC 100%)`,
                borderColor: "transparent",
                boxShadow: `0 2px 8px ${accentColor}50`,
              }}>
              添加审核员 / 管理员
            </Button>
              </>
            )}
          </Space>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        {user?.is_admin && (
        <Card size="small" style={{ borderRadius: 14, marginBottom: 16 }} styles={{ body: { padding: "10px 16px" } }}>
          <Space size="large" wrap>
            <Badge count={users.length} color={accentColor} showZero>
              <Text style={{ fontSize: 13 }}>有权限用户</Text>
            </Badge>
            <Text type="secondary" style={{ fontSize: 13 }}>
              审核员 <Text strong>{isReviewerCount}</Text> · 管理员 <Text strong>{isAdminCount}</Text>
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              封禁 <Text strong>{bans.length}</Text> 人
            </Text>
          </Space>
        </Card>
        )}
      </div>

      <div style={{ padding: "0 16px" }}>
        <Tabs
          items={[
            {
              key: "system",
              label: <span><MonitorOutlined style={{ marginRight: 6 }} />系统信息</span>,
              children: <AdminSystemInfo />,
            },
            {
              key: "images",
              label: <span><PictureOutlined style={{ marginRight: 6 }} />图片管理</span>,
              children: <AdminImages />,
            },
            ...(user?.is_admin
              ? [
            {
              key: "users",
              label: <span><TeamOutlined style={{ marginRight: 6 }} />权限用户</span>,
              children: (
                <Card size="small" style={{ borderRadius: 14 }} styles={{ body: { padding: 0 } }}>
                  <Table
                    rowKey="qq"
                    columns={userColumns}
                    dataSource={users}
                    loading={loadingUsers}
                    pagination={false}
                    size="middle"
                    locale={{
                      emptyText: "暂无审核员或管理员",
                    }}
                  />
                </Card>
              ),
            },
            {
              key: "bans",
              label: <span><StopOutlined style={{ marginRight: 6 }} />封禁名单</span>,
              children: (
                <Card size="small" style={{ borderRadius: 14 }} styles={{ body: { padding: 0 } }}>
                  <Table
                    rowKey="qq"
                    columns={banColumns}
                    dataSource={bans}
                    loading={loadingBans}
                    pagination={{ pageSize: 10, hideOnSinglePage: true, size: "small" }}
                    size="middle"
                    locale={{ emptyText: "暂无封禁用户" }}
                  />
                </Card>
              ),
            },
              ]
              : []),
          ]}
        />
      </div>

      <Modal
        title="添加审核员 / 管理员"
        open={addOpen}
        onOk={handleAddUser}
        onCancel={() => setAddOpen(false)}
        okText="添加"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" initialValues={{ role: 1 }}>
          <Form.Item
            name="qq"
            label="QQ 号"
            rules={[{ required: true, message: "请输入 QQ 号" }, { pattern: /^\d{5,12}$/, message: "QQ 号格式不正确" }]}
          >
            <Input placeholder="例如 123456789" maxLength={12} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: "请选择角色" }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            重复的 QQ 号会覆盖原有角色。
          </Text>
        </Form>
      </Modal>

      <Modal
        title="封禁用户"
        open={banOpen}
        onOk={handleBanUser}
        onCancel={() => setBanOpen(false)}
        okText="封禁"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={banForm} layout="vertical">
          <Form.Item
            name="qq"
            label="QQ 号"
            rules={[{ required: true, message: "请输入 QQ 号" }, { pattern: /^\d{5,12}$/, message: "QQ 号格式不正确" }]}
          >
            <Input placeholder="要封禁的 QQ 号" maxLength={12} />
          </Form.Item>
          <Form.Item name="reason" label="原因">
            <Input.TextArea rows={3} placeholder="例如 违规上传图片" maxLength={100} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
