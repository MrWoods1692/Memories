import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App, Badge, Button, Card, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Tooltip, Typography,
} from "antd";
import {
  SafetyCertificateOutlined, TeamOutlined, UndoOutlined,
  UserAddOutlined, UserDeleteOutlined, StopOutlined, ReloadOutlined,
} from "@ant-design/icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  addAdminUser, banAdminUser, fetchAdminBans, fetchAdminUsers,
  removeAdminUser, unbanAdminUser,
} from "@/api/admin";
import type { AdminBan, AdminUser } from "@/types";

const { Title, Text } = Typography;

const roleOptions = [
  { value: 1, label: "审核员" },
  { value: 2, label: "管理员" },
];

const roleLabel = (role: number) => (role === 2 ? "管理员" : "审核员");

/** 后台页面：仅管理员可见，管理审核员/管理员与封禁名单 */
export default function AdminPage() {
  const { message, modal } = App.useApp();
  const { accentColor } = useTheme();
  const { user } = useAuth();

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

  const userColumns = [
    {
      title: "QQ 号",
      dataIndex: "qq",
      key: "qq",
      render: (qq: string) => (
        <Space size="small">
          <Text style={{ fontWeight: 500 }}>{qq}</Text>
          {String(qq) === String(user?.qq) && <Tag color="blue" style={{ margin: 0 }}>我</Tag>}
        </Space>
      ),
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
      render: (_: unknown, record: AdminUser) => (
        <Tooltip title={String(record.qq) === String(user?.qq) ? "不能移除自己的权限" : "移除"}>
          <Button
            danger
            size="small"
            icon={<UserDeleteOutlined />}
            disabled={String(record.qq) === String(user?.qq)}
            onClick={() => handleRemoveUser(record)}
            style={{ borderRadius: 8 }}
          />
        </Tooltip>
      ),
    },
  ];

  const banColumns = [
    { title: "QQ 号", dataIndex: "qq", key: "qq", render: (qq: string) => <Text style={{ fontWeight: 500 }}>{qq}</Text> },
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
                审核员与管理员、封禁名单
              </Text>
            </div>
          </div>
          <Space size="small" wrap>
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
          </Space>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
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
      </div>

      <div style={{ padding: "0 16px" }}>
        <Tabs
          items={[
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
