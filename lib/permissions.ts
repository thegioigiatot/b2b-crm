// Danh sách quyền chi tiết + bộ mặc định theo vai trò. Thuần dữ liệu, không đụng Prisma.

export type Role = "ADMIN" | "MANAGER" | "SALES";
export const ROLES: Role[] = ["ADMIN", "MANAGER", "SALES"];

export type PermKey =
  // Tầm nhìn dữ liệu
  | "viewAllCustomers"
  | "viewAllSales"
  | "viewAllDeals"
  | "viewAllLeads"
  | "viewAllTasks"
  | "viewAllDashboard"
  // Deal / Lead / Việc
  | "editAnyRecord" // sửa/xoá bản ghi của người khác (mặc định chỉ sửa của mình)
  | "deleteRecords" // được xoá deal / lead / việc
  | "changeDealOwner"
  | "convertLead"
  // Quản trị nghiệp vụ
  | "manageCatalog" // Danh mục
  | "managePipeline" // Giai đoạn pipeline
  | "manageScoring" // Bộ chấm điểm
  | "manageKpi"
  | "manageWorkRhythm" // định nghĩa nhịp công việc + xem/log hộ người khác
  // Hệ thống
  | "manageUsers" // kích hoạt / gán vai trò / nối nhân viên
  | "managePermissions"; // sửa chính bảng quyền này

export const PERM_GROUPS: { title: string; keys: { key: PermKey; label: string; hint?: string }[] }[] = [
  {
    title: "Tầm nhìn dữ liệu",
    keys: [
      { key: "viewAllCustomers", label: "Xem toàn bộ khách hàng và Contact" },
      { key: "viewAllSales", label: "Xem toàn bộ doanh số và hợp đồng" },
      { key: "viewAllDeals", label: "Xem toàn bộ deal", hint: "Tắt = chỉ deal của mình hoặc đang theo dõi" },
      { key: "viewAllLeads", label: "Xem toàn bộ lead", hint: "Tắt = chỉ lead mình phụ trách" },
      { key: "viewAllTasks", label: "Xem toàn bộ công việc" },
      { key: "viewAllDashboard", label: "Dashboard toàn team", hint: "Tắt = số liệu của riêng mình" },
    ],
  },
  {
    title: "Deal · Lead · Công việc",
    keys: [
      { key: "editAnyRecord", label: "Sửa/xoá bản ghi của người khác" },
      { key: "deleteRecords", label: "Được xoá deal / lead / việc" },
      { key: "changeDealOwner", label: "Đổi người sở hữu deal" },
      { key: "convertLead", label: "Chuyển đổi lead thành deal" },
    ],
  },
  {
    title: "Quản trị nghiệp vụ",
    keys: [
      { key: "manageCatalog", label: "Quản lý Danh mục" },
      { key: "managePipeline", label: "Quản lý Giai đoạn pipeline" },
      { key: "manageScoring", label: "Quản lý Bộ chấm điểm" },
      { key: "manageKpi", label: "Thiết lập KPI" },
      { key: "manageWorkRhythm", label: "Quản lý Nhịp công việc", hint: "Định nghĩa việc lặp + xem/log hộ người khác" },
    ],
  },
  {
    title: "Hệ thống",
    keys: [
      { key: "manageUsers", label: "Quản lý người dùng" },
      { key: "managePermissions", label: "Sửa bảng phân quyền" },
    ],
  },
];

export const PERM_KEYS: PermKey[] = PERM_GROUPS.flatMap((g) => g.keys.map((k) => k.key));

export function permLabel(key: string) {
  for (const g of PERM_GROUPS) for (const k of g.keys) if (k.key === key) return k.label;
  return key;
}

type PermMap = Record<PermKey, boolean>;

function fill(v: boolean): PermMap {
  return Object.fromEntries(PERM_KEYS.map((k) => [k, v])) as PermMap;
}

export const DEFAULT_ROLE_PERMS: Record<Role, PermMap> = {
  ADMIN: fill(true),
  MANAGER: {
    ...fill(true),
    manageUsers: false,
    managePermissions: false,
  },
  SALES: {
    ...fill(false),
    convertLead: true, // sales tự chuyển đổi lead của mình
  },
};

// Quyền không bao giờ tắt được cho ADMIN để tránh tự khoá mình ra ngoài.
export const ADMIN_LOCKED: PermKey[] = ["manageUsers", "managePermissions"];

export function parsePermMap(raw: string | null | undefined, fallback: PermMap): PermMap {
  if (!raw) return { ...fallback };
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...fallback };
    for (const k of PERM_KEYS) if (typeof obj[k] === "boolean") out[k] = obj[k] as boolean;
    return out;
  } catch {
    return { ...fallback };
  }
}

// Ghi đè riêng theo user: chỉ chứa các key có mặt (true/false).
export function parsePartialPerms(raw: string | null | undefined): Partial<PermMap> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<PermMap> = {};
    for (const k of PERM_KEYS) if (typeof obj[k] === "boolean") out[k] = obj[k] as boolean;
    return out;
  } catch {
    return {};
  }
}

// Quyền hiệu lực = ghi đè user ?? cấu hình vai trò ?? mặc định vai trò; ADMIN bị khoá vài quyền = true.
export function resolvePerms(
  role: Role,
  roleConfigRaw: string | null | undefined,
  userExtraRaw: string | null | undefined,
): PermMap {
  const base = parsePermMap(roleConfigRaw, DEFAULT_ROLE_PERMS[role] ?? DEFAULT_ROLE_PERMS.SALES);
  const extra = parsePartialPerms(userExtraRaw);
  const eff = { ...base, ...extra } as PermMap;
  if (role === "ADMIN") for (const k of ADMIN_LOCKED) eff[k] = true;
  return eff;
}

export function serialisePermMap(map: PermMap): string {
  return JSON.stringify(map);
}
