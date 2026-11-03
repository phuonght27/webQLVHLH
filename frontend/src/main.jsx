import ActionMenu from "./ActionMenu";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import SidebarIcon from "./SidebarIcon";
import "./sidebar-icons.css";
import { api } from "./api";
import Homework from "./Homework";
import ClassManagement from "./ClassManagement";
import ManagerPassword from "./ManagerPassword";
import GradeEntry from "./GradeEntry";
import LearningData from "./LearningData";
import RetakeReview from "./RetakeReview";
import GradeSingleAdd from "./GradeSingleAdd";
import SubmissionProgress from "./SubmissionProgress";
const sections = [
  ["⌂", "home", "Trang chủ"],
  ["♙", "accounts", "Quản lý tài khoản"],
  ["▣", "courses", "Quản lý khóa học"],
  ["◷", "shifts", "Quản lý ca học"],
  ["♧", "classes", "Danh sách lớp học"],
  ["⊞", "enrollments", "Thành viên lớp học"],
  ["▦", "schedules", "Quản lý lịch học"],
  ["▤", "assignments", "Quản lý bài tập"],
  ["↗", "allocations", "Giao bài tập"],
  ["⇧", "submissions", "Theo dõi bài nộp"],
  ["✎", "comments", "Nhận xét bài tập"],
  ["⚑", "exceptions", "Ngoại lệ bài nộp"],
  ["▧", "grades", "Quản lý điểm"],
  ["✓", "progress", "Trạng thái nộp bài"],
  ["⌁", "learning", "Dữ liệu học tập"],
  ["↺", "retakes", "Yêu cầu học lại"],
];
function Logo() {
  return (
    <div className="logo">
      The <strong>Toeic</strong> Lab<span>╰────────╯</span>
    </div>
  );
}

function EditProfile({ user, onSave, onCancel, run }) {
  const [form, setForm] = React.useState({
    name: user.name || "",
    gender: user.gender || "",
    phone: user.phone || "",
    address: user.address || "",
  });

  const [avatar, setAvatar] = React.useState(null);
  const [preview, setPreview] = React.useState(user.avatar || "");
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  const change = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e = {};

    if (!form.name.trim()) {
      e.name = "Họ và tên không được để trống";
    } else if (
      form.name.length > 255 ||
      !/^[\p{L}\s]+$/u.test(form.name.trim())
    ) {
      e.name = "Họ tên chỉ gồm chữ và khoảng trắng, tối đa 255 ký tự";
    }

    if (!["Nam", "Nữ"].includes(form.gender)) {
      e.gender = "Vui lòng chọn giới tính";
    }

    if (!/^0[0-9]{9}$/.test(form.phone)) {
      e.phone = "SĐT phải gồm 10 số và bắt đầu bằng 0";
    }

    if (!form.address.trim()) {
      e.address = "Địa chỉ không được để trống";
    } else if (form.address.length > 255) {
      e.address = "Địa chỉ tối đa 255 ký tự";
    }

    if (avatar) {
      if (!["image/jpeg", "image/png"].includes(avatar.type)) {
        e.avatar = "Chỉ chấp nhận ảnh JPG hoặc PNG";
      } else if (avatar.size > 5 * 1024 * 1024) {
        e.avatar = "Ảnh không được vượt quá 5 MB";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;

    if (!window.confirm("Bạn có chắc chắn muốn lưu thay đổi?")) {
      return;
    }

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      payload.append(key, value);
    });

    if (avatar) payload.append("avatar", avatar);

    setSaving(true);
    try {
      const result = await run(() =>
        api("profile/update/", payload)
      );

      if (result?.ok) {
        onSave(result.user);
      }
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, element, required = true) => (
    <div className="edit-profile-field">
      <label>
        {label} {required && <span className="required">*</span>}
      </label>
      <div>
        {element}
        {errors[key] && (
          <small className="field-error">{errors[key]}</small>
        )}
      </div>
    </div>
  );

  return (
    <div className="edit-profile-form">
      <h2>Chỉnh sửa tài khoản</h2>

      <div className="edit-avatar">
        <strong>Ảnh đại diện <span className="required">*</span></strong>

        {preview ? (
          <img src={preview} alt="Ảnh đại diện" />
        ) : (
          <div className="avatar-placeholder">👤</div>
        )}

        <label className="upload-button">
          Tải lên ảnh
          <input
            type="file"
            accept=".jpg,.jpeg,.png"
            hidden
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;

              setAvatar(file);
              setErrors(prev => ({ ...prev, avatar: "" }));
              setPreview(URL.createObjectURL(file));
            }}
          />
        </label>

        {errors.avatar && (
          <small className="field-error">{errors.avatar}</small>
        )}
      </div>

      {field("Họ và tên", "name",
        <input
          value={form.name}
          maxLength={255}
          onChange={e => change("name", e.target.value)}
        />
      )}

      {field("Giới tính", "gender",
        <select
          value={form.gender}
          onChange={e => change("gender", e.target.value)}
        >
          <option value="">Chọn giới tính</option>
          <option value="Nam">Nam</option>
          <option value="Nữ">Nữ</option>
        </select>
      )}

      {field("Số điện thoại", "phone",
        <input
          value={form.phone}
          maxLength={10}
          inputMode="numeric"
          onChange={e => change("phone", e.target.value)}
        />
      )}

      {field("Email", "email",
        <input value={user.email || ""} disabled readOnly />
      )}

      {field("Mã người dùng", "code",
        <input value={user.code || ""} disabled readOnly />,
        false
      )}

      {field("Địa chỉ", "address",
        <textarea
          value={form.address}
          maxLength={255}
          onChange={e => change("address", e.target.value)}
        />,
      )}

      {field("Vai trò", "role",
        <input value={user.role_label || ""} disabled readOnly />,
        false
      )}

      <div className="edit-profile-actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Hủy
        </button>
        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </div>
  );
}


const roleMenus = [
  {
    key: "accounts",
    icon: "♙",
    title: "Quản lý Tài khoản",
    roles: ["QLCN", "QLLH"],
  },
  {
    key: "class-group",
    icon: "♧",
    title: "Quản lý Lớp học",
    roles: ["QLCN", "QLLH", "GV", "HV"],
    children: [
      {
        key: "courses",
        title: "Quản lý khóa học",
        icon: "▣",
        roles: ["QLCN"],
      },
      {
        key: "shifts",
        title: "Quản lý ca học",
        icon: "◷",
        roles: ["QLCN"],
      },
      {
        key: "classes",
        title: "Quản lý danh sách lớp học",
        icon: "♧",
        roles: ["QLCN", "QLLH", "GV"],
      },
      {
        key: "schedules",
        title: "Quản lý lịch học",
        icon: "▦",
        roles: ["QLCN", "QLLH", "GV", "HV"],
      },
    ],
  },
  {
    key: "assignments",
    icon: "▤",
    title: "Quản lý Bài tập",
    roles: ["QLCN", "QLLH", "GV", "HV"],
    children: [
      { key: "assignments", title: "Danh sách bài tập", icon: "▤", roles: ["QLCN", "GV"] },
      { key: "progress", title: "Trạng thái bài nộp", icon: "✓", roles: ["QLCN", "GV"] },
    ],
  },
  {
    key: "grades",
    icon: "▧",
    title: "Quản lý Điểm",
    roles: ["QLCN", "QLLH", "GV", "HV"],
  },
  {
    key: "learning",
    icon: "⌁",
    title: "Quản lý Dữ liệu Học tập",
    roles: ["QLCN","QLLH", "GV", "HV"],
    children: [
      { key: "learning-grades", title: "Điểm các bài kiểm tra", roles: ["QLCN","GV","HV"] },
      { key: "learning-submissions", title: "Trạng thái nộp bài", roles: ["QLCN","GV","HV"] },
      { key: "learning-comments", title: "Nhận xét bài tập", roles: ["QLCN","GV","HV"] },
    ],
  },
];

function App() {
  const [user, U] = useState(undefined),
    [section, S] = useState("home"),
    [error, E] = useState(""),
    [toast, T] = useState(""),
    [modal, M] = useState(null),
    [refresh, R] = useState(0);
    
const [expandedMenus, setExpandedMenus] = useState({});
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

function toggleMenu(title) {
  setExpandedMenus(prev => ({
    ...prev,
    [title]: !prev[title],
  }));
}

  useEffect(() => {
    api("auth/session/")
      .then((d) => U(d.user))
      .catch((e) => E(e.message));
  }, []);
  const run = async (fn) => {
    E("");
    try {
      return await fn();
    } catch (e) {
      E(e.message);
      return null;
    }
  };
  function notify(t) {
    T(t);
    setTimeout(() => T(""), 6000);
  }
  async function signout() {
    await api("auth/logout/", {});
    U(null);
    S("home");
  }
  if (user === undefined)
    return <div className="loading">Đang kết nối hệ thống…{error}</div>;
  if (!user || user.must_change_password)
    return (
      <Auth
        user={user}
        onLogin={U}
        run={run}
        error={error}
        notify={notify}
        toast={toast}
      />
    );

  const visibleMenus = roleMenus
    .filter(menu => menu.roles.includes(user.role))
    .map(menu => ({
      ...menu,
      children: menu.key === "learning" && user.role === "QLLH" ? undefined : menu.children?.filter(child =>
        child.roles.includes(user.role) || (user.role === "QLLH" && ["courses", "shifts"].includes(child.key))
      ),
    }));

  return (
    <div className="app">

<aside className={sidebarCollapsed ? "sidebar-collapsed" : ""}>
  <div className="sidebar-logo">
    {!sidebarCollapsed && <Logo />}
    <button
      type="button"
      className="sidebar-toggle"
      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      title="Thu gọn / Mở rộng menu"
    >
      <SidebarIcon name="menu" />
    </button>
  </div>

  <nav className="sidebar-nav">
    {visibleMenus.map(menu => {
      const children = menu.children || [];
      const isGroup = children.length > 0;
      const isActive = isGroup
        ? children.some(child => child.key === section)
        : menu.key === section;

      const isExpanded =
        expandedMenus[menu.title] ?? isActive;

      return (
        <div className="sidebar-menu-group" key={menu.title}>
          <button
            type="button"
            className={
              "sidebar-parent " +
              (isActive ? "selected " : "")
            }
            title={menu.title}
            onClick={() => {
              if (isGroup) {
                toggleMenu(menu.title);
                if (menu.key === "assignments") { S("assignments"); E(""); }
              } else {
                S(menu.key);
                E("");
              }
            }}
          >
            <span className="sidebar-icon"><SidebarIcon name={menu.key} /></span>

            {!sidebarCollapsed && (
              <>
                <span className="sidebar-label">
                  {menu.title}
                </span>
                {isGroup && (
                  <span className={"sidebar-chevron" + (isExpanded ? " is-expanded" : "")}>
                    <SidebarIcon name="chevron" />
                  </span>
                )}
              </>
            )}
          </button>

          {isGroup && isExpanded && !sidebarCollapsed && (
            <div className="sidebar-submenu">
              {children.map((child, index) => (
                <button
                  type="button"
                  key={`${child.key}-${index}`}
                  className={
                    "sidebar-child " +
                    (section === child.key ? "selected" : "")
                  }
                  onClick={() => {
                    S(child.key);
                    E("");
                  }}
                >

<span className="sidebar-child-icon">
  <SidebarIcon name={child.key} />
</span>
<span className="sidebar-child-label">
  {child.title}
</span>

                </button>
              ))}
            </div>
          )}
        </div>
      );
    })}
  </nav>

  <button
    type="button"
    className="logout"
    onClick={() => {
      if (window.confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
        run(signout);
      }
    }}
  >
    <SidebarIcon name="logout" /> {!sidebarCollapsed && "Đăng xuất"}
  </button>
</aside>

      <main>
        <header>
          <h1>
            {visibleMenus.find(menu => menu.key === section)?.title ||
              visibleMenus
                .flatMap(menu => menu.children || [])
                .find(child => child.key === section)?.title ||
              "Tổng quan"}
          </h1>
          <button className="profile" onClick={() => M({ type: "profile" })}>
            <span className="avatar">{user.name?.split(" ").pop()?.[0]}</span>
            <span>
              {user.name}
              <small>{user.role_label}</small>
            </span>
            ⌄
          </button>
        </header>
        {error && (
          <div role="alert" className="alert">
            {error}
            <button onClick={() => E("")}>×</button>
          </div>
        )}
        {toast && (
          <div role="status" className="toast">
            ✓ {toast}
          </div>
        )}
        <div className="content">
          {((user.role === "QLLH" && ["courses", "shifts", "classes", "schedules"].includes(section)) || (user.role === "QLCN" && ["courses", "shifts"].includes(section))) ? (
            <ClassManagement key={section} kind={section} user={user} notify={notify} />
          ) : section === "assignments" ? (
            user.role === "QLLH" ? (
              <SubmissionProgress refresh={refresh} notify={notify} />
            ) : (
              <Homework user={user} notify={notify} refresh={refresh} open={M} />
            )
          ) : section === "progress" ? (
            <SubmissionProgress refresh={refresh} notify={notify} />
          ) : section === "home" ? (
            <Dashboard
              learning={section === "learning"}
              run={run}
              user={user}
            />
          ) : section === "learning" && user.role === "QLLH" ? (
            <RetakeReview />
          ) : section.startsWith("learning-") || section === "learning" ? (
            <LearningData key={section} selectedTab={section === "learning-submissions" ? "submissions" : section === "learning-comments" ? "comments" : "grades"} hideTabs />
          ) : (
            <Records
              key={section}
              kind={section}
              user={user}
              run={run}
              notify={notify}
              refresh={refresh}
              reload={() => R((x) => x + 1)}
              open={M}
            />
          )}
        </div>
        <footer>The Toeic Lab · Hệ thống quản lý vận hành lớp học</footer>
      </main>
      {modal && (
        <div
          className="overlay"
          onMouseDown={(e) => e.target === e.currentTarget && M(null)}
        >
          <div className="modal">
            <button className="close" onClick={() => M(null)}>
              ×
            </button>
            {modal.type === "grade-entry" ? (
              <GradeEntry notify={notify} done={() => { M(null); R(x => x + 1); }} />
            ) : modal.type === "grade-single-add" ? (
              <GradeSingleAdd notify={notify} done={() => { M(null); R(x => x + 1); }} />
            ) : modal.type === "allocate" ? (
              <AllocationEditor
                assignment={modal.id}
                done={() => {
                  M(null);
                  R((x) => x + 1);
                }}
                notify={notify}
              />
            ) : modal.type === "profile" ? (
              <section className="account-info-view">
                <h2>Thông tin tài khoản</h2>
                <div className="account-info-avatar">
                  {user.avatar ? (
                    <img src={user.avatar} alt="Ảnh đại diện" />
                  ) : (
                    <div className="account-info-avatar-placeholder" aria-label="Chưa có ảnh đại diện">
                      {user.name?.trim()?.charAt(0) || "👤"}
                    </div>
                  )}
                </div>
                <dl className="account-info-list">
                  {[
                    ["Họ và tên", user.name],
                    ["Giới tính", user.gender],
                    ["Mã người dùng", user.code],
                    ["Email", user.email],
                    ["Số điện thoại", user.phone],
                    ["Địa chỉ", user.address],
                    ["Vai trò", user.role_label],
                  ].map(([label, value]) => (
                    <React.Fragment key={label}>
                      <dt>{label}</dt>
                      <dd>{value || "—"}</dd>
                    </React.Fragment>
                  ))}
                </dl>
                <div className="account-info-actions">
                  <button type="button" onClick={() => M({ type: "edit-profile" })}>
                    <span aria-hidden="true">✎</span> Chỉnh sửa
                  </button>
                  <button type="button" onClick={() => M({ type: "password" })}>
                    <span aria-hidden="true">♙</span> Đổi mật khẩu
                  </button>
                  <button type="button" className="primary" onClick={() => M(null)}>
                    Đóng
                  </button>
                </div>
              </section>

            ) : modal.type === "edit-profile" ? (
              <EditProfile
                user={user}
                run={run}
                onCancel={() => M({ type: "profile" })}
                onSave={(updatedUser) => {
                  U(updatedUser);
                  M({ type: "profile" });
                  notify("Cập nhật thông tin tài khoản thành công!");
                }}
              />
              
            ) : modal.type === "password" ? (
              user.role === "QLLH" ? (
                <ManagerPassword user={user} notify={notify} done={() => { U(null); M(null); }} />
              ) : (
                <Password run={run} done={() => { U(null); M(null); }} />
              )
            ) : (
              <Editor
                spec={modal}
                run={run}
                notify={notify}
                done={() => {
                  M(null);
                  R((x) => x + 1);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function Auth({ user, onLogin, run, error, notify, toast }) {
  const [mode, SM] = useState("login"),
    [busy, B] = useState(false),
    [show, SH] = useState(false),
    [email, SE] = useState("");
  async function submit(e) {
    e.preventDefault();
    B(true);
    let d = Object.fromEntries(new FormData(e.target));
    if (mode === "login") d.remember = !!d.remember;
    await run(async () => {
      if (user) {
        await api("auth/password/", d);
        onLogin(null);
        notify("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
      } else if (mode === "login") {
        const result = await api("auth/login/", d);
        onLogin(result.user);
      } else if (mode === "forgot") {
        await api("auth/forgot/", d);
        SE(d.email);
        SM("reset");
        notify("Nếu email hợp lệ, mã xác thực đã được gửi.");
      } else {
        await api("auth/reset/", d);
        SM("login");
        notify("Đã đặt lại mật khẩu.");
      }
    });
    B(false);
  }
  if (user) {
    return (
      <FirstPasswordChange
        run={run}
        error={error}
        toast={toast}
        onLogin={onLogin}
        notify={notify}
      />
    );
  }
  return (
    <div className="auth">
      {toast && <div className="toast">{toast}</div>}
      <Logo />
      <form onSubmit={submit}>
        <h2>
          {user
            ? "Đổi mật khẩu lần đầu"
            : mode === "login"
              ? "Đăng nhập"
              : mode === "forgot"
                ? "Quên mật khẩu"
                : "Đặt lại mật khẩu"}
        </h2>
        <p className="muted">Hệ thống quản lý học tập The Toeic Lab</p>
        {error && (
          <div role="alert" className="alert">
            {error}
          </div>
        )}
        {user ? (
          <label>
            Mật khẩu hiện tại
            <input
              name="old_password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
        ) : (
          <label>
            Email
            <input
              type="email"
              name="email"
              defaultValue={email}
              placeholder="Nhập email của bạn"
              autoComplete="email"
              required
            />
          </label>
        )}
        {mode === "reset" && !user && (
          <label>
            Mã xác thực
            <input
              name="code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              placeholder="Mã 6 chữ số"
            />
          </label>
        )}
        {(mode !== "forgot" || user) && (
          <label>
            {mode === "login" && !user
              ? "Mật khẩu"
              : "Mật khẩu mới (ít nhất 10 ký tự)"}
            <div className="password">
              <input
                name="password"
                type={show ? "text" : "password"}
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={mode === "login" ? undefined : 10}
                placeholder="Nhập mật khẩu"
              />
              <button
                type="button"
                onClick={() => SH(!show)}
                aria-label="Hiện hoặc ẩn mật khẩu"
              >
                ◉
              </button>
            </div>
          </label>
        )}
        {mode === "login" && !user && (
          <div className="authlinks">
            <label>
              <input type="checkbox" name="remember" /> Ghi nhớ đăng nhập
            </label>
            <button type="button" onClick={() => SM("forgot")}>
              Quên mật khẩu?
            </button>
          </div>
        )}
        <button className="primary full" disabled={busy}>
          {busy
            ? "Đang xử lý…"
            : user
              ? "Đổi mật khẩu"
              : mode === "login"
                ? "Đăng nhập"
                : mode === "forgot"
                  ? "Gửi mã xác thực"
                  : "Xác nhận"}
        </button>
        {mode === "reset" && !user && (
          <button
            className="full link"
            type="button"
            onClick={() =>
              run(async () => {
                await api("auth/forgot/", { email });
                notify("Nếu email hợp lệ, mã mới đã được gửi.");
              })
            }
          >
            Gửi lại mã xác thực
          </button>
        )}
        {mode !== "login" && !user && (
          <button
            className="full link"
            type="button"
            onClick={() => SM("login")}
          >
            Quay lại đăng nhập
          </button>
        )}
      </form>
      <p className="authfoot">Quản lý tập trung · Kết nối việc dạy và học</p>
    </div>
  );
}
function FirstPasswordChange({ run, error, toast, onLogin, notify }) {
  const [visible, setVisible] = useState({});
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const fields = [
    ["old_password", "Mật khẩu hiện tại", "current-password"],
    ["password", "Mật khẩu mới", "new-password"],
    ["confirm_password", "Xác nhận mật khẩu", "new-password"],
  ];

  function validate(values) {
    const errors = {};
    if (!values.old_password) errors.old_password = "Vui lòng nhập mật khẩu hiện tại.";
    if (!values.password) {
      errors.password = "Vui lòng nhập mật khẩu mới.";
    } else if (
      values.password.length < 10 ||
      !/[A-Z]/.test(values.password) ||
      !/[a-z]/.test(values.password) ||
      !/[0-9]/.test(values.password) ||
      !/[^A-Za-z0-9]/.test(values.password)
    ) {
      errors.password = "Mật khẩu mới phải có tối thiểu 10 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.";
    } else if (values.password === values.old_password) {
      errors.password = "Mật khẩu mới phải khác mật khẩu hiện tại.";
    }
    if (!values.confirm_password) {
      errors.confirm_password = "Vui lòng xác nhận mật khẩu mới.";
    } else if (values.confirm_password !== values.password) {
      errors.confirm_password = "Xác nhận mật khẩu không khớp với mật khẩu mới.";
    }
    return errors;
  }

  async function submit(e) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const errors = validate(values);
    setFieldErrors(errors);
    setServerError("");
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      await run(async () => {
        try {
          await api("auth/password/", {
            old_password: values.old_password,
            password: values.password,
          });
          onLogin(null);
          notify("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
        } catch (err) {
          const message = err.message || "Không thể cập nhật mật khẩu.";
          if (/mật khẩu hiện tại không đúng/i.test(message)) {
            setFieldErrors({ old_password: "Mật khẩu hiện tại không đúng. Vui lòng kiểm tra và nhập lại." });
          } else {
            setServerError(message);
          }
        }
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth first-password-auth">
      {toast && <div className="toast">{toast}</div>}
      <Logo />
      <form className="first-password-card" onSubmit={submit} noValidate>
        <div className="first-password-notice" role="status">
          <span className="first-password-warning" aria-hidden="true">!</span>
          <div>
            <strong>Bạn đang sử dụng mật khẩu tạm thời.</strong>
            <p>Vui lòng đổi mật khẩu mới để tiếp tục sử dụng hệ thống.</p>
          </div>
        </div>
        {(serverError || error) && (
          <div role="alert" className="first-password-error">{serverError || error}</div>
        )}
        {fields.map(([name, title, autocomplete]) => (
          <label key={name} htmlFor={name} className="first-password-label">
            {title}:
            <span className="first-password-input">
              <span className="first-password-lock" aria-hidden="true">♙</span>
              <input
                id={name}
                name={name}
                type={visible[name] ? "text" : "password"}
                autoComplete={autocomplete}
                aria-invalid={!!fieldErrors[name]}
                aria-describedby={fieldErrors[name] ? name + "-error" : undefined}
                onChange={() => {
                  setFieldErrors(prev => ({ ...prev, [name]: "" }));
                  setServerError("");
                }}
              />
              <button
                type="button"
                aria-label={visible[name] ? "Ẩn " + title : "Hiện " + title}
                aria-pressed={!!visible[name]}
                onClick={() => setVisible(v => ({ ...v, [name]: !v[name] }))}
              >
                {visible[name] ? "◉" : "◎"}
              </button>
            </span>
            {fieldErrors[name] && (
              <span className="first-password-error" id={name + "-error"} role="alert">
                <span className="first-password-error-icon" aria-hidden="true">!</span>
                {fieldErrors[name]}
              </span>
            )}
          </label>
        ))}
        <button className="primary first-password-submit" type="submit" disabled={busy}>
          {busy ? "Đang cập nhật…" : "Cập nhật"}
        </button>
      </form>
    </div>
  );
}
function Password({ run, done }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target));
        run(async () => {
          await api("auth/password/", d);
          done();
        });
      }}
    >
      <h2>Đổi mật khẩu</h2>
      <label>
        Mật khẩu hiện tại
        <input name="old_password" type="password" required />
      </label>
      <label>
        Mật khẩu mới
        <input name="password" type="password" minLength={10} required />
      </label>
      <p className="muted">
        Sau khi đổi mật khẩu, hệ thống sẽ đăng xuất các phiên hiện tại.
      </p>
      <button className="primary">Xác nhận</button>
    </form>
  );
}
function Dashboard({ learning, run, user }) {
  const [d, D] = useState(null),
    [tab, ST] = useState("grades"),
    [q, Q] = useState("");
  useEffect(() => {
    run(async () => D(await api("overview/")));
  }, []);
  if (!d) return <p>Đang tải dữ liệu…</p>;
  return (
    <>
      {!learning && (
        <div className="hero">
          <div>
            <span className="eyebrow">THE TOEIC LAB / LEARNING MANAGEMENT</span>
            <h2>Chào mừng, {user.name.split(" ").pop()}!</h2>
            <p>
              Mỗi buổi học là một bước tiến.
              <br />
              Cùng theo dõi và kết nối hành trình học tập.
            </p>
            <span className="herobadge">
              Quản lý lớp học · Bài tập · Kết quả học tập
            </span>
          </div>
          <div className="heroart">
            <span>THE</span>
            <strong>TOEIC</strong>
            <span>LAB</span>
            <i>Learn. Practice. Achieve.</i>
          </div>
        </div>
      )}
      <div className="stats">
        {[
          ["Lớp học", d.classes, "▣"],
          ["Học viên trong lớp", d.students, "♧"],
          ["Bài tập đã giao", d.assignments, "▤"],
          ["Bài đã nộp", d.submitted, "✓"],
        ].map(([label, value, icon]) => (
          <div className="stat" key={label}>
            <span>{icon}</span>
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
            </div>
          </div>
        ))}
      </div>
      {learning ? (
        <>
          <div className="tabs">
            <button
              className={tab === "grades" ? "active" : ""}
              onClick={() => ST("grades")}
            >
              Điểm bài kiểm tra
            </button>
            <button
              className={tab === "comments" ? "active" : ""}
              onClick={() => ST("comments")}
            >
              Nhận xét bài tập
            </button>
          </div>
          <input
            className="search"
            value={q}
            onChange={(e) => Q(e.target.value)}
            placeholder="Tìm kiếm thông tin học tập…"
          />
          <div className="card">
            {tab === "grades" ? (
              <>
                <h3>Kết quả học tập</h3>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Học viên / Lớp",
                          "Loại kiểm tra",
                          "Listening",
                          "Reading",
                          "Speaking",
                          "Writing",
                          "Ngày kiểm tra",
                          "Ghi chú",
                          "Overall",
                        ].map((x) => (
                          <th key={x}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.grades
                        .filter((g) =>
                          g.values
                            .join(" ")
                            .toLowerCase()
                            .includes(q.toLowerCase()),
                        )
                        .map((g) => (
                          <tr key={g.id}>
                            {g.values.map((v, i) => (
                              <td key={i}>{v}</td>
                            ))}
                            <td>
                              <b>{g.extra.Overall}</b>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!d.grades.length && <Empty />}
              </>
            ) : (
              <>
                <h3>Nhận xét bài tập</h3>
                {d.comments
                  .filter((c) =>
                    Object.values(c)
                      .join(" ")
                      .toLowerCase()
                      .includes(q.toLowerCase()),
                  )
                  .map((c, i) => (
                    <article key={i}>
                      <b>{c.student}</b>
                      <small>{c.assignment}</small>
                      <p>{c.content}</p>
                    </article>
                  ))}
                {!d.comments.length && <Empty />}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          <div className="cardhead">
            <h3>Lịch học sắp tới</h3>
            <span className="muted">Theo phạm vi được phân công</span>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Ngày học</th>
                  <th>Lớp học</th>
                  <th>Ca học</th>
                  <th>Phòng học</th>
                </tr>
              </thead>
              <tbody>
                {d.upcoming.map((s, i) => (
                  <tr key={i}>
                    <td>{s.date}</td>
                    <td>
                      <b>{s.classroom}</b>
                    </td>
                    <td>{s.shift}</td>
                    <td>{s.room}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!d.upcoming.length && <Empty text="Chưa có lịch học sắp tới" />}
        </div>
      )}
    </>
  );
}
function Empty({ text = "Chưa có dữ liệu" }) {
  return (
    <div className="empty">
      <span>▤</span>
      <h3>{text}</h3>
      <p>Thử thay đổi từ khóa hoặc bộ lọc.</p>
    </div>
  );
}

function GradeDetail({ data, onBack }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const total = data.grades.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const visible = data.grades.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return (
    <div className="grade-detail-page">
      <h2>QUẢN LÝ ĐIỂM</h2>

      <button className="grade-back" onClick={onBack}>
        ← Quay lại danh sách
      </button>

      <h3>Thông tin chi tiết điểm</h3>

      <div className="tablewrap grade-detail-table">
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Họ và tên</th>
              <th>Mã học viên</th>
              <th>Loại bài kiểm tra</th>
              <th>Điểm listening</th>
              <th>Điểm speaking</th>
              <th>Điểm reading</th>
              <th>Điểm writing</th>
              <th>Điểm overall</th>
            </tr>
          </thead>

          <tbody>
            {visible.map((g, index) => (
              <tr key={g.id}>
                <td>{(page - 1) * pageSize + index + 1}</td>
                <td>{data.student_name}</td>
                <td>{data.student_code}</td>
                <td>{g.exam_type}</td>
                <td>{g.listening}</td>
                <td>{g.speaking}</td>
                <td>{g.reading}</td>
                <td>{g.writing}</td>
                <td><strong>{g.overall}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total === 0 && <Empty text="Chưa có điểm kiểm tra" />}

      <div className="grade-detail-pagination">
        <label>
          Hiển thị{" "}
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          {" "}bản ghi trên mỗi trang
        </label>

        <div>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            ‹
          </button>

          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              className={page === i + 1 ? "primary" : ""}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}

          <button
            disabled={page === pages}
            onClick={() => setPage(p => p + 1)}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

function Records({ kind, user, run, notify, refresh, reload, open }) {
  const [result, D] = useState(null),
    [q, Q] = useState(""),
    [query, SQ] = useState(""),
    [page, P] = useState(1),
    [archived, A] = useState(false),
    [detail, DE] = useState(null),
    [status, SS] = useState(""),
    [filters, FL] = useState({}),
    [gradeFilterOpen, setGradeFilterOpen] = useState(false);
  useEffect(() => {
    D(null);
    run(async () =>
      D(
        await api(
          `${kind}/?q=${encodeURIComponent(query)}&page=${page}&archived=${archived ? 1 : 0}&status=${encodeURIComponent(status)}&${new URLSearchParams(Object.fromEntries(Object.entries(filters).map(([k, v]) => ["filter_" + k, v])))}`,
        ),
      ),
    );
  }, [kind, query, page, archived, refresh, status, JSON.stringify(filters)]);
  async function act(id, action) {
    if (!confirm("Bạn có chắc chắn muốn thực hiện thao tác này?")) return;
    await run(async () => {
      await api(
        `${kind}/${id}/`,
        action ? { _action: action } : null,
        action ? "PATCH" : "DELETE",
      );
      notify("Đã cập nhật thành công.");
      DE(null);
      reload();
    });
  }

  async function show(id) {
    await run(async () => {
      if (kind === "grades") {
        const data = await api(`grades/${id}/detail/`);
        DE({ gradePage: true, ...data });
      } else {
        DE(await api(`${kind}/${id}/`));
      }
    });
  }

  function exportRows() {
    const headers = [
      ...result.columns,
      ...Object.keys(result.rows[0]?.extra || {}),
    ];
    const rows = result.rows.map((r) => [
      ...r.values,
      ...Object.values(r.extra),
    ]);
    saveCSV(kind + ".csv", [headers, ...rows]);
    notify("Đã xuất dữ liệu của trang hiện tại.");
  }

if (!result) return <p>Đang tải danh sách…</p>;

if (kind === "grades" && detail?.gradePage) {
  return (
    <GradeDetail
      data={detail}
      onBack={() => DE(null)}
    />
  );
}

  const accountMode = kind === "accounts";
  const gradeMode = kind === "grades";
  const accountColumns = result.columns || [];
  const accountCell = (r, label) => {
    const index = accountColumns.findIndex(c => c.toLowerCase().includes(label.toLowerCase()));
    return index >= 0 ? r.values[index] : "";
  };
  const accountStatus = (r) => {
    const values = [...r.values, ...Object.values(r.extra || {})];
    return values.find(v => v === "Active" || v === "Inactive") || "Active";
  };
  const accountStatusColumn = accountColumns.findIndex(c => /trạng thái|status/i.test(c));
  const rows = result.rows;
  return (
    <>
      {gradeMode ? (
        <div className="grade-management-toolbar">
          <div className="grade-management-search">
            <button type="button" onClick={() => setGradeFilterOpen(v => !v)} aria-expanded={gradeFilterOpen} aria-controls="grade-filter-panel">☷ &nbsp; Lọc</button>
            <form onSubmit={e => { e.preventDefault(); SQ(q); P(1); }}>
              <input value={q} onChange={e => Q(e.target.value)} placeholder="⌕  Nhập từ khóa tìm kiếm (Họ tên, Mã học viên, ...)" />
              <button className="primary" type="submit">Tìm kiếm</button>
            </form>
          </div>
          {result.can_write && <div className="grade-management-buttons"><button className="primary" type="button" onClick={() => open({type:"grade-entry"})}>Nhập điểm</button><button className="primary" type="button" onClick={() => open({type:"grade-single-add"})}>＋ Thêm điểm</button></div>}
        </div>
      ) : accountMode ? (
        <div className="account-management-toolbar">
          <div className="account-management-search">
            <button type="button" onClick={() => document.getElementById("account-filter-panel")?.classList.toggle("is-open")}>☷ &nbsp; Lọc</button>
            <form onSubmit={e => { e.preventDefault(); SQ(q); P(1); }}>
              <input value={q} onChange={e => Q(e.target.value)} placeholder="⌕  Nhập từ khóa tìm kiếm (Họ tên, Mã người dùng, Địa chỉ, SĐT, Email)" />
              <button className="primary" type="submit">Tìm kiếm</button>
            </form>
          </div>
          <div className="account-management-buttons">
            <button type="button" onClick={exportRows}>⇩ &nbsp; Xuất CSV</button>
            {result.can_write && <button type="button" className="primary" onClick={() => open({type:"edit",kind})}>♙ &nbsp; Thêm tài khoản</button>}
            {result.can_write && <button type="button" className="primary" onClick={() => open({type:"bulk",kind})}>♙ &nbsp; Tạo hàng loạt</button>}
          </div>
        </div>
      ) : (
        <div className="toolbar">
          <form className="searchform" onSubmit={e => { e.preventDefault(); SQ(q); P(1); }}>
            <input value={q} onChange={e => Q(e.target.value)} placeholder="⌕  Nhập mã, tên hoặc nội dung cần tìm…" />
            <button className="primary">Tìm</button>
          </form>
          <div className="actions">
            {["accounts", "grades", "allocations"].includes(kind) && result.can_write && <button onClick={() => open({type:"bulk",kind})}>⇧ Nhập hàng loạt</button>}
            <button onClick={exportRows}>⇩ Xuất CSV</button>
            {["courses", "shifts", "classes", "schedules"].includes(kind) && <button className={archived ? "primary" : ""} onClick={() => { A(!archived); P(1); }}>▱ {archived ? "Đang lưu trữ" : "Lưu trữ"}</button>}
            {result.can_write && <button className="primary" onClick={() => open({type:"edit",kind})}>＋ Thêm mới</button>}
          </div>
        </div>
      )}
      {gradeMode && <div id="grade-filter-panel" className={`filters grade-management-filters grade-advanced-filters${gradeFilterOpen ? " is-open" : ""}`}>
        {result.filters?.map(f => {
          const choices = f.name === "classroom" && filters.course
            ? f.choices.filter(c => c.course === filters.course)
            : f.choices;
          const selected = (filters[f.name] || "").split(",").filter(Boolean);
          return <div className="grade-filter-field" key={f.name}>
            <label>{f.label}</label>
            {f.multiple ? <details className="grade-filter-multi">
              <summary>{selected.length ? choices.filter(c => selected.includes(c.value)).map(c => c.label).join(", ") || `Đã chọn ${selected.length}` : "Tất cả"} <span className="grade-filter-chevron">⌄</span></summary>
              <div className="grade-filter-options">
                <button type="button" className="grade-filter-all" onClick={() => { FL(p => ({ ...p, [f.name]: "" })); P(1); }}>Tất cả</button>
                {choices.map(c => <label key={c.value} className={selected.includes(c.value) ? "is-selected" : ""}><input className="grade-filter-hidden-checkbox" type="checkbox" checked={selected.includes(c.value)} onChange={e => {
                  const next = e.target.checked ? [...selected, c.value] : selected.filter(v => v !== c.value);
                  FL(p => ({ ...p, [f.name]: next.join(",") })); P(1);
                }} />{c.label}</label>)}
                {!choices.length && <span>Không có lựa chọn phù hợp</span>}
              </div>
            </details> : <select value={filters[f.name] || ""} onChange={e => {
              FL(p => ({ ...p, [f.name]: e.target.value, ...(f.name === "course" ? { classroom: "" } : {}) })); P(1);
            }}><option value="">Tất cả</option>{choices.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>}
          </div>;
        })}
        <button type="button" className="danger" onClick={() => { FL({}); Q(""); SQ(""); P(1); }}>× Xóa bộ lọc</button>
      </div>}
      {!gradeMode && <div id={accountMode ? "account-filter-panel" : undefined} className={accountMode ? "filters account-management-filters" : "filters"}>
        {result.filters?.map((f) => (
          <label key={f.name}>
            {f.label}
            <select
              value={filters[f.name] || ""}
              onChange={(e) => {
                FL({ ...filters, [f.name]: e.target.value });
                P(1);
              }}
            >
              <option value="">Tất cả</option>
              {f.choices.map((c) => (
                <option value={c.value} key={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Trạng thái
          <select
            value={status}
            onChange={(e) => {
              SS(e.target.value);
              P(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {(result.status_options || []).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <span className="muted">
          {result.total} bản ghi trong phạm vi quyền truy cập
        </span>
        <button
          className="danger"
          onClick={() => {
            Q("");
            SQ("");
            SS("");
            FL({});
            P(1);
          }}
        >
          × Xóa bộ lọc
        </button>
      </div>}
      <div className={accountMode ? "card list account-management-table" : gradeMode ? "card list grade-management-table" : "card list"}>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>STT</th>
                {result.columns.map((x, i) => (
                  <th key={i}>{x}</th>
                ))}
                {Object.keys(result.rows[0]?.extra || {}).map((x) => (
                  <th key={x}>{x}</th>
                ))}
                {!accountMode && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} onClick={accountMode ? () => show(r.id) : undefined} className={accountMode ? "account-management-row" : undefined} title={accountMode ? "Nhấn để xem thông tin tài khoản" : undefined}>
                  <td>{(page - 1) * 10 + i + 1}</td>
                  {r.values.map((v, j) => (
                    <td key={j} className={j === 0 ? "emphasis" : ""}>
                      {accountMode && ["Active", "Inactive"].includes(v) ? (
                        <select className={"account-status-select " + (v === "Active" ? "is-active" : "is-inactive")} value={v} disabled={!result.can_write} aria-label="Trạng thái tài khoản" onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); act(r.id, "toggle"); }}><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
                      ) : ["Active", "Inactive"].includes(v) ? (
                        <span
                          className={
                            "badge " + (v === "Active" ? "green" : "red")
                          }
                        >
                          {v}
                        </span>
                      ) : v.length > 100 ? (
                        v.slice(0, 100) + "…"
                      ) : (
                        v
                      )}
                    </td>
                  ))}
                  {Object.entries(r.extra).map(([k, v]) => (
                    <td key={k}>
                      <span
                        className={
                          k.includes("Trạng thái") || k === "Kết quả"
                            ? "badge"
                            : ""
                        }
                      >
                        {v}
                      </span>
                    </td>
                  ))}
                  {!accountMode && <td>
                    <ActionMenu>
                      <button onClick={() => show(r.id)}>
                        {kind === "grades" ? "◎ Xem chi tiết" : "◎ Chi tiết"}
                      </button>
                      {result.can_write && (
                        <>
                          {kind === "assignments" && (
                            <button
                              onClick={() =>
                                open({ type: "allocate", id: r.id })
                              }
                            >
                              ↗ Giao nhiều lớp
                            </button>
                          )}
                          <button
                            onClick={() =>
                              open({ type: "edit", kind, id: r.id })
                            }
                          >
                            ✎ Sửa
                          </button>
                          {[
                            "courses",
                            "shifts",
                            "classes",
                            "schedules",
                          ].includes(kind) && (
                            <button
                              onClick={() =>
                                act(r.id, archived ? "restore" : "archive")
                              }
                            >
                              {archived ? "Khôi phục" : "Lưu trữ"}
                            </button>
                          )}
                          {kind === "accounts" ? (
                            <button onClick={() => act(r.id, "toggle")}>
                              Active / Inactive
                            </button>
                          ) : (
                            <button
                              className="danger"
                              onClick={() =>
                                act(
                                  r.id,
                                  kind === "enrollments"
                                    ? r.extra["Trạng thái"] === "Đã rời lớp"
                                      ? "rejoin"
                                      : "leave"
                                    : null,
                                )
                              }
                            >
                              {kind === "submissions"
                                ? "Hủy nộp"
                                : kind === "enrollments"
                                  ? r.extra["Trạng thái"] === "Đã rời lớp"
                                    ? "Tham gia lại"
                                    : "Rời lớp"
                                  : "Xóa"}
                            </button>
                          )}
                        </>
                      )}
                      {kind === "retakes" &&
                        ["QLCN", "QLLH"].includes(user.role) && (
                          <button
                            onClick={() =>
                              open({ type: "review", kind, id: r.id })
                            }
                          >
                            Xét duyệt
                          </button>
                        )}
                    </ActionMenu>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty />}
        <div className="pagination">
          <span>
            Trang {page} · Tổng {result.total} bản ghi
          </span>
          <div>
            <button disabled={page <= 1} onClick={() => P(page - 1)}>
              ‹
            </button>
            <button className="primary">{page}</button>
            <button
              disabled={page * 10 >= result.total}
              onClick={() => P(page + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </div>
      {detail && (
        <div className="overlay">
          <div className="modal">
            <button className="close" onClick={() => DE(null)}>
              ×
            </button>
            <h2>Thông tin chi tiết</h2>
            <p className="muted">ID dữ liệu: {detail.id} (dùng khi nhập CSV)</p>
            <dl>
              {result.columns.map((c, i) => (
                <React.Fragment key={c}>
                  <dt>{c}</dt>
                  <dd>{detail.values[i]}</dd>
                </React.Fragment>
              ))}
              {Object.entries(detail.extra).map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </React.Fragment>
              ))}
            </dl>
            {detail.members && (
              <>
                <h3>Danh sách học viên</h3>
                {detail.members.map((m) => (
                  <p key={m.id}>
                    {m.student} · <span className="badge">{m.status}</span>
                  </p>
                ))}
                <h3>Các buổi học</h3>
                {detail.sessions.map((s) => (
                  <p key={s.id}>
                    Buổi {s.number} · {s.date} · {s.shift} · {s.room}{" "}
                    {s.cancelled ? "· Đã hủy" : ""}
                  </p>
                ))}
              </>
            )}
            {detail.comments?.map((c) => (
              <article key={c.id}>
                <b>{c.author}</b>
                <p>{c.content}</p>
              </article>
            ))}
            {detail.files && (
              <>
                <h3>Tài liệu đính kèm</h3>
                {detail.files.map((f) => (
                  <p key={f.id}>
                    <a href={`/api/files/${f.id}/`}>{f.name}</a>
                  </p>
                ))}
                {result.can_write && (
                  <label>
                    Thêm tệp (PDF, DOCX, PNG, JPEG ≤ 20 MB)
                    <input
                      type="file"
                      accept=".pdf,.docx,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file)
                          run(async () => {
                            const form = new FormData();
                            form.append("file", file);
                            await api(`${kind}/${detail.id}/upload/`, form);
                            await show(detail.id);
                            notify("Đã tải tệp lên.");
                          });
                      }}
                    />
                  </label>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
function Editor({ spec, run, notify, done }) {
  const [fields, F] = useState(null),
    [busy, B] = useState(false),
    [error, E] = useState(""),
    [secret, SEC] = useState(null);
  useEffect(() => {
    if (spec.type === "edit")
      api(`${spec.kind}/${spec.id ? spec.id + "/" : ""}?form=1`)
        .then((d) => F(d.fields))
        .catch((e) => E(e.message));
  }, []);
  async function submit(e) {
    e.preventDefault();
    B(true);
    E("");
    try {
      const form = new FormData(e.target);
      let payload = Object.fromEntries(form);
      fields
        ?.filter((f) => f.type === "multi")
        .forEach((f) => (payload[f.name] = form.getAll(f.name)));
      if (spec.type === "review") {
        await api(`retakes/${spec.id}/review/`, payload);
      } else if (spec.type === "bulk") {
        const rows = parseCSV(payload.csv);
        const r = await api(`bulk/${spec.kind}/`, { rows });
        if (spec.kind === "accounts") {
          SEC(r.created);
          B(false);
          return;
        }
      } else {
        if (!confirm("Xác nhận lưu thông tin?")) {
          B(false);
          return;
        }
        const d = await api(
          `${spec.kind}/${spec.id ? spec.id + "/" : ""}`,
          payload,
          spec.id ? "PATCH" : "POST",
        );
        if (d.temporary_password) {
          SEC([
            { code: "ID " + d.id, temporary_password: d.temporary_password },
          ]);
          B(false);
          return;
        }
      }
      notify("Đã lưu dữ liệu thành công.");
      done();
    } catch (e) {
      E(e.message);
    }
    B(false);
  }
  if (secret)
    return (
      <>
        <h2>Tài khoản đã được tạo</h2>
        <p>
          Lưu mật khẩu tạm ngay. Thông tin này chỉ hiển thị trong lần tạo này.
        </p>
        {secret.map((s, i) => (
          <p key={i}>
            <b>{s.code}</b>　<code>{s.temporary_password}</code>
          </p>
        ))}
        <button
          onClick={() =>
            saveCSV("tai-khoan-moi.csv", [
              ["Mã", "Mật khẩu tạm"],
              ...secret.map((s) => [s.code, s.temporary_password]),
            ])
          }
        >
          Tải CSV mật khẩu tạm
        </button>
        <button className="primary" onClick={done}>
          Đã lưu, đóng
        </button>
      </>
    );
  return (
    <form onSubmit={submit}>
      <h2>
        {spec.type === "bulk"
          ? "Nhập dữ liệu hàng loạt"
          : spec.type === "review"
            ? "Xét duyệt yêu cầu học lại"
            : spec.id
              ? "Chỉnh sửa thông tin"
              : "Thêm mới"}
      </h2>
      {error && (
        <div role="alert" className="alert">
          {error}
        </div>
      )}
      {spec.type === "bulk" ? (
        <>
          <p className="muted">
            Nhập CSV tối đa 200 dòng. Lỗi ở một dòng sẽ hủy toàn bộ lần nhập.
            Các khóa ngoại dùng ID trong CSDL.
          </p>
          <p>
            Tiêu đề cột:{" "}
            <code>
              {spec.kind === "accounts"
                ? "full_name,gender,phone,email,address,role"
                : spec.kind === "allocations"
                  ? "assignment,classroom,session,deadline"
                  : "enrollment,exam_type,listening,reading,speaking,writing,exam_date,note"}
            </code>
          </p>
          <label>
            Chọn tệp CSV UTF-8
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file)
                  file
                    .text()
                    .then(
                      (s) => (document.querySelector("[name=csv]").value = s),
                    );
              }}
            />
          </label>
          <textarea
            name="csv"
            rows={10}
            required
            placeholder="Dán nội dung CSV tại đây"
          />
        </>
      ) : spec.type === "review" ? (
        <>
          <p className="muted">
            Hệ thống ghi nhận điểm và tỷ lệ nộp bài tại thời điểm xét duyệt.
            Người quản lý quyết định và ghi rõ lý do. Không sử dụng tiêu chí
            nghỉ học khi chưa có dữ liệu điểm danh.
          </p>
          <label>
            Kết quả
            <select name="status">
              <option value="approved">Đồng ý</option>
              <option value="rejected">Từ chối</option>
            </select>
          </label>
          <label>
            Lý do
            <textarea name="note" required maxLength={500} />
          </label>
        </>
      ) : fields ? (
        <div className="formgrid">
          {fields.map((f) => (
            <label
              key={f.name}
              className={
                f.type === "textarea" || f.type === "multi" ? "wide" : ""
              }
            >
              {f.label}
              {f.required && <em> *</em>}
              {f.type === "select" || f.type === "multi" ? (
                <select
                  name={f.name}
                  required={f.required}
                  multiple={f.type === "multi"}
                  defaultValue={f.value ?? (f.type === "multi" ? [] : "")}
                >
                  {f.choices.map((c) => (
                    <option value={c.value} key={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.name}
                  required={f.required}
                  maxLength={f.maxLength}
                  defaultValue={f.value || ""}
                />
              ) : (
                <input
                  name={f.name}
                  type={f.type}
                  required={f.required}
                  maxLength={f.maxLength}
                  step={f.type === "number" ? "0.5" : undefined}
                  min={f.type === "number" ? 0 : undefined}
                  max={f.type === "number" ? 10 : undefined}
                  defaultValue={
                    f.type === "datetime-local"
                      ? f.value?.slice(0, 16)
                      : (f.value ?? "")
                  }
                />
              )}
            </label>
          ))}
        </div>
      ) : (
        <p>Đang tải biểu mẫu…</p>
      )}
      <div className="formfooter">
        <button type="button" onClick={done}>
          Đóng
        </button>
        <button
          className="primary"
          disabled={busy || (spec.type === "edit" && !fields)}
        >
          {busy ? "Đang lưu…" : "Xác nhận"}
        </button>
      </div>
    </form>
  );
}
function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i <= s.length; i++) {
    let c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if ((c === "," || c === "\n" || c === undefined) && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      cell = "";
      if (c !== ",") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) throw Error("CSV có dấu ngoặc kép chưa đóng.");
  const headers = rows.shift()?.map((x) => x.trim());
  if (!headers) throw Error("CSV trống.");
  return rows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] || ""])),
  );
}
function saveCSV(name, rows) {
  const quote = (x) => '"' + String(x ?? "").replaceAll('"', '""') + '"';
  const safe = (x) => (/^[=+@\-\t\r]/.test(String(x)) ? "'" + x : x);
  const blob = new Blob(
    [
      "\uFEFF" +
        rows.map((r) => r.map((x) => quote(safe(x))).join(",")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
createRoot(document.getElementById("root")).render(<App />);

function AllocationEditor({ assignment, done, notify }) {
  const [fields, F] = useState(null),
    [selected, S] = useState([]),
    [values, V] = useState({}),
    [error, E] = useState(""),
    [busy, B] = useState(false);
  useEffect(() => {
    api("allocations/?form=1")
      .then((d) => F(d.fields))
      .catch((e) => E(e.message));
  }, []);
  const classes =
    fields
      ?.find((f) => f.name === "classroom")
      ?.choices.filter((c) => c.value) || [];
  const sessions = fields?.find((f) => f.name === "session")?.choices || [];
  function update(id, key, value) {
    V({ ...values, [id]: { ...values[id], [key]: value } });
  }
  async function submit(e) {
    e.preventDefault();
    B(true);
    E("");
    try {
      if (!selected.length) throw Error("Chọn ít nhất một lớp học.");
      const rows = selected.map((id) => ({
        assignment,
        classroom: id,
        session: values[id]?.session,
        deadline: values[id]?.deadline,
      }));
      await api("bulk/allocations/", { rows });
      notify("Đã giao bài tập cho " + rows.length + " lớp.");
      done();
    } catch (e) {
      E(e.message);
    }
    B(false);
  }
  return (
    <form onSubmit={submit}>
      <h2>Tạo và giao bài tập cho nhiều lớp</h2>
      <p className="muted">
        Nội dung bài tập dùng chung; mỗi lớp có buổi học và hạn nộp riêng. Hệ
        thống lưu toàn bộ trong một giao dịch.
      </p>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {!fields ? (
        <p>Đang tải các lớp được phân công…</p>
      ) : (
        classes.map((c) => (
          <article key={c.value}>
            <label className="checkrow">
              <input
                type="checkbox"
                checked={selected.includes(c.value)}
                onChange={(e) =>
                  S(
                    e.target.checked
                      ? [...selected, c.value]
                      : selected.filter((x) => x !== c.value),
                  )
                }
              />
              {c.label}
            </label>
            {selected.includes(c.value) && (
              <div className="formgrid">
                <label>
                  Buổi học
                  <select
                    required
                    value={values[c.value]?.session || ""}
                    onChange={(e) => update(c.value, "session", e.target.value)}
                  >
                    <option value="">Chọn buổi đã/đang diễn ra</option>
                    {sessions
                      .filter((s) => String(s.classroom_id) === c.value)
                      .map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Hạn nộp
                  <input
                    type="datetime-local"
                    required
                    value={values[c.value]?.deadline || ""}
                    onChange={(e) =>
                      update(c.value, "deadline", e.target.value)
                    }
                  />
                </label>
              </div>
            )}
          </article>
        ))
      )}
      {fields && !classes.length && (
        <Empty text="Bạn chưa được phân công lớp học" />
      )}
      <div className="formfooter">
        <button type="button" onClick={done}>
          Đóng
        </button>
        <button className="primary" disabled={busy}>
          {busy ? "Đang giao bài…" : "Xác nhận giao bài"}
        </button>
      </div>
    </form>
  );
}
