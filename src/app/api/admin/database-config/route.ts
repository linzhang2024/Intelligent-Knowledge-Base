import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

const DB_TYPES = {
  SQLITE: "SQLITE",
  POSTGRESQL: "POSTGRESQL",
  MYSQL: "MYSQL",
  ORACLE: "ORACLE",
} as const;

type DBType = typeof DB_TYPES[keyof typeof DB_TYPES];

interface DatabaseConfig {
  type: DBType;
  databaseUrl: string;
  host?: string;
  port?: string;
  user?: string;
  password?: string;
  database?: string;
  serviceName?: string;
  sid?: string;
}

interface PublicDatabaseConfig {
  type: DBType;
  databaseUrl: string;
  host?: string;
  port?: string;
  user?: string;
  database?: string;
  serviceName?: string;
  sid?: string;
  hasPassword: boolean;
}

const DEFAULT_PORTS: Record<DBType, string> = {
  SQLITE: "",
  POSTGRESQL: "5432",
  MYSQL: "3306",
  ORACLE: "1521",
};

const DEFAULT_USERS: Record<DBType, string> = {
  SQLITE: "",
  POSTGRESQL: "postgres",
  MYSQL: "root",
  ORACLE: "system",
};

const DEFAULT_DATABASES: Record<DBType, string> = {
  SQLITE: "",
  POSTGRESQL: "intelligent_knowledge_base",
  MYSQL: "intelligent_knowledge_base",
  ORACLE: "ORCL",
};

const projectRoot = path.resolve(process.cwd());
const envPath = path.join(projectRoot, ".env");

function parseDatabaseUrl(databaseUrl: string): DatabaseConfig {
  if (databaseUrl.startsWith("file:")) {
    return {
      type: DB_TYPES.SQLITE,
      databaseUrl,
    };
  }

  if (databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://")) {
    try {
      const url = new URL(databaseUrl);
      return {
        type: DB_TYPES.POSTGRESQL,
        databaseUrl,
        host: url.hostname,
        port: url.port || DEFAULT_PORTS.POSTGRESQL,
        user: url.username,
        password: url.password,
        database: url.pathname.replace(/^\//, ""),
      };
    } catch {
      return {
        type: DB_TYPES.POSTGRESQL,
        databaseUrl,
        host: "localhost",
        port: DEFAULT_PORTS.POSTGRESQL,
        user: DEFAULT_USERS.POSTGRESQL,
        password: "",
        database: DEFAULT_DATABASES.POSTGRESQL,
      };
    }
  }

  if (databaseUrl.startsWith("mysql://")) {
    try {
      const url = new URL(databaseUrl);
      return {
        type: DB_TYPES.MYSQL,
        databaseUrl,
        host: url.hostname,
        port: url.port || DEFAULT_PORTS.MYSQL,
        user: url.username,
        password: url.password,
        database: url.pathname.replace(/^\//, ""),
      };
    } catch {
      return {
        type: DB_TYPES.MYSQL,
        databaseUrl,
        host: "localhost",
        port: DEFAULT_PORTS.MYSQL,
        user: DEFAULT_USERS.MYSQL,
        password: "",
        database: DEFAULT_DATABASES.MYSQL,
      };
    }
  }

  if (databaseUrl.startsWith("oracle:thin:@") || databaseUrl.startsWith("jdbc:oracle:")) {
    const oracleMatch = databaseUrl.match(/@([^:]+):(\d+):(.+)$/);
    if (oracleMatch) {
      const [, host, port, sidOrService] = oracleMatch;
      const userMatch = databaseUrl.match(/\/\/([^:/]+):([^@]+)@/);
      return {
        type: DB_TYPES.ORACLE,
        databaseUrl,
        host,
        port,
        user: userMatch?.[1] || DEFAULT_USERS.ORACLE,
        password: userMatch?.[2] || "",
        sid: sidOrService,
      };
    }
    return {
      type: DB_TYPES.ORACLE,
      databaseUrl,
      host: "localhost",
      port: DEFAULT_PORTS.ORACLE,
      user: DEFAULT_USERS.ORACLE,
      password: "",
      sid: "ORCL",
    };
  }

  return {
    type: DB_TYPES.SQLITE,
    databaseUrl: "file:./dev.db",
  };
}

function buildDatabaseUrl(config: DatabaseConfig): string {
  if (config.type === DB_TYPES.SQLITE) {
    return config.databaseUrl || "file:./dev.db";
  }

  if (config.type === DB_TYPES.MYSQL) {
    const host = config.host || "localhost";
    const port = config.port || DEFAULT_PORTS.MYSQL;
    const user = encodeURIComponent(config.user || DEFAULT_USERS.MYSQL);
    const password = config.password ? encodeURIComponent(config.password) : "";
    const database = encodeURIComponent(config.database || DEFAULT_DATABASES.MYSQL);

    const auth = password ? `${user}:${password}` : user;
    return `mysql://${auth}@${host}:${port}/${database}`;
  }

  if (config.type === DB_TYPES.ORACLE) {
    const host = config.host || "localhost";
    const port = config.port || DEFAULT_PORTS.ORACLE;
    const user = config.user || DEFAULT_USERS.ORACLE;
    const password = config.password || "";
    const sid = config.sid || config.serviceName || "ORCL";

    if (password) {
      return `oracle:thin:@${host}:${port}:${sid}`;
    }
    return `oracle:thin:${user}/${password}@${host}:${port}:${sid}`;
  }

  const host = config.host || "localhost";
  const port = config.port || DEFAULT_PORTS.POSTGRESQL;
  const user = encodeURIComponent(config.user || DEFAULT_USERS.POSTGRESQL);
  const password = config.password ? encodeURIComponent(config.password) : "";
  const database = encodeURIComponent(config.database || DEFAULT_DATABASES.POSTGRESQL);

  const auth = password ? `${user}:${password}` : user;
  return `postgresql://${auth}@${host}:${port}/${database}`;
}

async function readEnvFile(): Promise<string> {
  if (!existsSync(envPath)) {
    return "";
  }
  return await fs.readFile(envPath, "utf-8");
}

async function writeEnvFile(content: string): Promise<void> {
  await fs.writeFile(envPath, content, "utf-8");
}

function updateEnvVariable(envContent: string, key: string, value: string): string {
  const escapedValue = value.replace(/"/g, '\\"');
  const newLine = `${key}="${escapedValue}"`;

  const regex = new RegExp(`^${escapeRegex(key)}=.*$`, "m");
  if (regex.test(envContent)) {
    return envContent.replace(regex, newLine);
  }

  return envContent.trim() ? `${envContent.trim()}\n${newLine}` : newLine;
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
    const config = parseDatabaseUrl(databaseUrl);

    const publicConfig: PublicDatabaseConfig = {
      type: config.type,
      databaseUrl: config.databaseUrl,
      host: config.host,
      port: config.port,
      user: config.user,
      database: config.database,
      serviceName: config.serviceName,
      sid: config.sid,
      hasPassword: !!config.password,
    };

    return NextResponse.json(
      {
        config: publicConfig,
        dbTypes: Object.values(DB_TYPES),
        defaultPorts: DEFAULT_PORTS,
        defaultUsers: DEFAULT_USERS,
        defaultDatabases: DEFAULT_DATABASES,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { message: "未登录，请先登录" },
          { status: 401 }
        );
      }
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { message: "无权限访问此资源" },
          { status: 403 }
        );
      }
    }
    console.error("获取数据库配置失败:", error);
    return NextResponse.json(
      { message: "获取数据库配置失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { type, host, port, user, password, database, sqlitePath, serviceName, sid } = body;

    if (!type || !Object.values(DB_TYPES).includes(type as DBType)) {
      return NextResponse.json(
        { message: `无效的数据库类型: ${type}` },
        { status: 400 }
      );
    }

    const dbType = type as DBType;

    let config: DatabaseConfig;

    if (type === DB_TYPES.SQLITE) {
      config = {
        type: DB_TYPES.SQLITE,
        databaseUrl: sqlitePath || "file:./dev.db",
      };
    } else if (type === DB_TYPES.MYSQL) {
      config = {
        type: DB_TYPES.MYSQL,
        databaseUrl: "",
        host: host || "localhost",
        port: port || DEFAULT_PORTS.MYSQL,
        user: user || DEFAULT_USERS.MYSQL,
        password: password || "",
        database: database || DEFAULT_DATABASES.MYSQL,
      };
      config.databaseUrl = buildDatabaseUrl(config);
    } else if (type === DB_TYPES.ORACLE) {
      config = {
        type: DB_TYPES.ORACLE,
        databaseUrl: "",
        host: host || "localhost",
        port: port || DEFAULT_PORTS.ORACLE,
        user: user || DEFAULT_USERS.ORACLE,
        password: password || "",
        serviceName: serviceName,
        sid: sid || serviceName,
      };
      config.databaseUrl = buildDatabaseUrl(config);
    } else {
      config = {
        type: DB_TYPES.POSTGRESQL,
        databaseUrl: "",
        host: host || "localhost",
        port: port || DEFAULT_PORTS.POSTGRESQL,
        user: user || DEFAULT_USERS.POSTGRESQL,
        password: password || "",
        database: database || DEFAULT_DATABASES.POSTGRESQL,
      };
      config.databaseUrl = buildDatabaseUrl(config);
    }

    let envContent = await readEnvFile();
    envContent = updateEnvVariable(envContent, "DATABASE_URL", config.databaseUrl);

    if (dbType !== DB_TYPES.SQLITE) {
      envContent = updateEnvVariable(envContent, "DB_HOST", config.host || "localhost");
      envContent = updateEnvVariable(envContent, "DB_PORT", config.port || DEFAULT_PORTS[dbType]);
      envContent = updateEnvVariable(envContent, "DB_USER", config.user || DEFAULT_USERS[dbType]);
      if (config.password) {
        envContent = updateEnvVariable(envContent, "DB_PASSWORD", config.password);
      }
      if (config.database) {
        envContent = updateEnvVariable(envContent, "DB_NAME", config.database);
      }
      if (type === DB_TYPES.ORACLE && config.sid) {
        envContent = updateEnvVariable(envContent, "DB_SID", config.sid);
      }
      if (type === DB_TYPES.ORACLE && config.serviceName) {
        envContent = updateEnvVariable(envContent, "DB_SERVICE_NAME", config.serviceName);
      }
    }

    await writeEnvFile(envContent);

    const publicConfig: PublicDatabaseConfig = {
      type: config.type,
      databaseUrl: config.databaseUrl.replace(/:([^:@/]+)@/, ":***@"),
      host: config.host,
      port: config.port,
      user: config.user,
      database: config.database,
      serviceName: config.serviceName,
      sid: config.sid,
      hasPassword: !!config.password,
    };

    const warnings: string[] = [];
    if (type === DB_TYPES.ORACLE) {
      warnings.push(
        "注意：Prisma 不直接支持 Oracle 数据库。当前配置仅用于测试连接，实际数据库操作需要额外配置或使用其他 ORM。"
      );
    }

    return NextResponse.json(
      {
        message: "数据库配置保存成功，请重启服务以应用新配置",
        config: publicConfig,
        needsRestart: true,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { message: "未登录，请先登录" },
          { status: 401 }
        );
      }
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { message: "无权限访问此资源" },
          { status: 403 }
        );
      }
    }
    console.error("保存数据库配置失败:", error);
    return NextResponse.json(
      { message: "保存数据库配置失败，请稍后重试" },
      { status: 500 }
    );
  }
}

function analyzeConnectionError(errorMessage: string, dbType: DBType): { errorType: string; suggestion: string } {
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes("econnrefused") || lowerMessage.includes("连接被拒绝")) {
    return {
      errorType: "CONNECTION_REFUSED",
      suggestion: `请检查 ${dbType} 数据库服务是否启动，主机地址和端口是否正确。`,
    };
  }

  if (lowerMessage.includes("authentication") || 
      lowerMessage.includes("password") || 
      lowerMessage.includes("access denied") ||
      lowerMessage.includes("invalid username")) {
    return {
      errorType: "AUTHENTICATION_ERROR",
      suggestion: "用户名或密码错误，请检查数据库凭据。",
    };
  }

  if (lowerMessage.includes("database") && lowerMessage.includes("exist")) {
    return {
      errorType: "DATABASE_NOT_EXIST",
      suggestion: "数据库不存在。请先创建数据库，或检查数据库名称是否正确。",
    };
  }

  if (lowerMessage.includes("timeout") || lowerMessage.includes("超时")) {
    return {
      errorType: "TIMEOUT_ERROR",
      suggestion: "连接超时。请检查网络连接、防火墙设置，或增加超时时间。",
    };
  }

  if (lowerMessage.includes("getaddrinfo") || lowerMessage.includes("enotfound") || lowerMessage.includes("dns")) {
    return {
      errorType: "DNS_ERROR",
      suggestion: "无法解析主机地址。请检查主机名或 IP 地址是否正确。",
    };
  }

  if (lowerMessage.includes("tns") || lowerMessage.includes("listener")) {
    return {
      errorType: "ORACLE_LISTENER_ERROR",
      suggestion: "Oracle 监听器未启动或配置错误。请检查 TNS 配置和监听器状态。",
    };
  }

  return {
    errorType: "CONNECTION_ERROR",
    suggestion: "请检查数据库配置是否正确，包括主机、端口、用户名、密码和数据库名。",
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { type, host, port, user, password, database, sqlitePath, serviceName, sid } = body;

    if (!type || !Object.values(DB_TYPES).includes(type)) {
      return NextResponse.json(
        { success: false, message: `无效的数据库类型: ${type}` },
        { status: 200 }
      );
    }

    const startTime = Date.now();

    try {
      if (type === DB_TYPES.SQLITE) {
        const dbPath = sqlitePath || "file:./dev.db";
        const actualPath = dbPath.replace("file:", "");
        const fullPath = path.resolve(projectRoot, actualPath);
        
        const exists = existsSync(fullPath);
        const latency = Date.now() - startTime;

        return NextResponse.json(
          {
            success: true,
            message: exists 
              ? `SQLite 数据库文件存在: ${actualPath}`
              : `SQLite 数据库文件不存在，将会自动创建: ${actualPath}`,
            latency,
          },
          { status: 200 }
        );
      }

      if (type === DB_TYPES.MYSQL) {
        try {
          const mysql = require("mysql2/promise");
          
          const connection = await mysql.createConnection({
            host: host || "localhost",
            port: parseInt(port || DEFAULT_PORTS.MYSQL, 10),
            user: user || DEFAULT_USERS.MYSQL,
            password: password || "",
            database: database || DEFAULT_DATABASES.MYSQL,
            connectTimeout: 5000,
          });

          await connection.execute("SELECT 1");
          await connection.end();

          const latency = Date.now() - startTime;

          return NextResponse.json(
            {
              success: true,
              message: `MySQL 连接成功！主机: ${host || "localhost"}, 数据库: ${database || DEFAULT_DATABASES.MYSQL}`,
              latency,
            },
            { status: 200 }
          );
        } catch (mysqlError) {
          throw mysqlError;
        }
      }

      if (type === DB_TYPES.ORACLE) {
        try {
          const oracledb = require("oracledb");
          
          let connectString: string;
          if (serviceName) {
            connectString = `${host || "localhost"}:${port || DEFAULT_PORTS.ORACLE}/${serviceName}`;
          } else {
            connectString = `${host || "localhost"}:${port || DEFAULT_PORTS.ORACLE}:${sid || "ORCL"}`;
          }

          const connection = await oracledb.getConnection({
            user: user || DEFAULT_USERS.ORACLE,
            password: password || "",
            connectString,
          });

          await connection.execute("SELECT 1 FROM DUAL");
          await connection.close();

          const latency = Date.now() - startTime;

          return NextResponse.json(
            {
              success: true,
              message: `Oracle 连接成功！主机: ${host || "localhost"}, ${serviceName ? `服务名: ${serviceName}` : `SID: ${sid || "ORCL"}`}`,
              latency,
            },
            { status: 200 }
          );
        } catch (oracleError: unknown) {
          const error = oracleError as { message?: string; code?: string };
          
          if (error.code === "MODULE_NOT_FOUND" || 
              (error.message && error.message.includes("Cannot find module"))) {
            return NextResponse.json(
              {
                success: false,
                message: "Oracle 驱动未安装。请先安装 oracledb: npm install oracledb",
                errorType: "DRIVER_MISSING",
                suggestion: "运行命令: npm install oracledb，并确保已安装 Oracle Instant Client。",
              },
              { status: 200 }
            );
          }
          throw oracleError;
        }
      }

      const { Pool } = require("pg");
      
      const pool = new Pool({
        host: host || "localhost",
        port: parseInt(port || DEFAULT_PORTS.POSTGRESQL, 10),
        user: user || DEFAULT_USERS.POSTGRESQL,
        password: password || "",
        database: database || DEFAULT_DATABASES.POSTGRESQL,
        connectionTimeoutMillis: 5000,
      });

      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      await pool.end();

      const latency = Date.now() - startTime;

      return NextResponse.json(
        {
          success: true,
          message: `PostgreSQL 连接成功！主机: ${host || "localhost"}, 数据库: ${database || DEFAULT_DATABASES.POSTGRESQL}`,
          latency,
        },
        { status: 200 }
      );
    } catch (connectionError) {
      const errorMessage = connectionError instanceof Error ? connectionError.message : String(connectionError);
      
      const { errorType, suggestion } = analyzeConnectionError(errorMessage, type);

      return NextResponse.json(
        {
          success: false,
          message: `连接失败: ${errorMessage}`,
          errorType,
          suggestion,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { success: false, message: "未登录，请先登录" },
          { status: 401 }
        );
      }
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { success: false, message: "无权限访问此资源" },
          { status: 403 }
        );
      }
    }
    console.error("测试数据库连接失败:", error);
    return NextResponse.json(
      { success: false, message: "测试连接失败，请稍后重试" },
      { status: 500 }
    );
  }
}
