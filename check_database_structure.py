#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查 SQLite 数据库结构，确认系统关键数据
"""

import sqlite3
import os
import sys

# 设置控制台编码为 UTF-8
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

DB_PATH = "prisma/dev.db"

def check_database():
    if not os.path.exists(DB_PATH):
        print(f"❌ 数据库文件不存在：{DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("=" * 80)
    print(" SQLite 数据库结构检查")
    print("=" * 80)
    print()
    
    # 获取所有表
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]
    
    print(f"📊 数据库文件：{DB_PATH}")
    print(f"📋 共有 {len(tables)} 个表\n")
    
    # 系统关键表（绝对不能删除）
    CRITICAL_TABLES = {
        'users': '用户账户信息（登录、权限等）',
        'knowledge_bases': '知识库配置（用户创建的知识库）',
        'documents': '文档元数据（上传的文档记录）',
        'document_chunks': '文档分块内容和向量（RAG 检索用）',
        'system_configs': '系统配置（Milvus、RAG 等配置）',
    }
    
    # 可以清理的表（从 SQL 文件导入的表结构）
    CLEANUP_TABLES = {
        'database_tables': '从 SQL 文件解析的表元数据（可删除）',
        'table_columns': '从 SQL 文件解析的字段信息（可删除）',
        'table_relations': '从 SQL 文件解析的表关系（可删除）',
        'sql_queries': '保存的 SQL 查询（可删除）',
        'query_history': '查询历史（可删除）',
    }
    
    print("=" * 80)
    print(" ⚠️  系统关键表（绝对不能删除）")
    print("=" * 80)
    
    for table_name in sorted(CRITICAL_TABLES.keys()):
        if table_name in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            
            print(f"\n✅ {table_name}")
            print(f"   说明：{CRITICAL_TABLES[table_name]}")
            print(f"   数据量：{count} 行")
            
            # 显示示例数据
            if count > 0:
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 2")
                rows = cursor.fetchall()
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = [col[1] for col in cursor.fetchall()]
                
                print(f"   列：{', '.join(columns)}")
                print(f"   示例:")
                for i, row in enumerate(rows, 1):
                    # 敏感信息脱敏
                    if table_name == 'users':
                        # users: id, email, password, name, role, status...
                        safe_row = list(row)
                        if len(safe_row) >= 2:
                            safe_row[1] = safe_row[1][:3] + "***" if safe_row[1] else None  # email 脱敏
                        if len(safe_row) >= 3:
                            safe_row[2] = "******"  # password 隐藏
                        print(f"     {i}. id={safe_row[0]}, email={safe_row[1]}, role={safe_row[4]}, status={safe_row[5]}")
                    else:
                        print(f"     {i}. {row}")
        else:
            print(f"\n⚠️  {table_name} (表不存在)")
    
    print("\n" + "=" * 80)
    print(" 🗑️  可清理的表（从 SQL 文件导入的表结构）")
    print("=" * 80)
    
    for table_name in sorted(CLEANUP_TABLES.keys()):
        if table_name in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            
            print(f"\n📊 {table_name}")
            print(f"   说明：{CLEANUP_TABLES[table_name]}")
            print(f"   数据量：{count} 行")
            
            # 显示示例数据
            if count > 0:
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 2")
                rows = cursor.fetchall()
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = [col[1] for col in cursor.fetchall()]
                
                print(f"   列：{', '.join(columns)}")
                print(f"   示例:")
                for i, row in enumerate(rows, 1):
                    if table_name == 'database_tables':
                        # id, name, schemaName, tableComment, knowledgeBaseId, documentId
                        if len(row) >= 4:
                            print(f"     {i}. 表名={row[1]}, 注释={row[3][:50] if row[3] else 'None'}...")
                    elif table_name == 'table_columns':
                        # id, tableId, name, dataType, columnComment...
                        if len(row) >= 4:
                            print(f"     {i}. 字段名={row[2]}, 类型={row[3]}")
                    elif table_name == 'table_relations':
                        # fromTableId, fromColumnName, toTableId, toColumnName, relationType
                        if len(row) >= 6:
                            print(f"     {i}. {row[2]}.{row[3]} -> {row[4]}.{row[5]}")
                    else:
                        print(f"     {i}. {row}")
        else:
            print(f"\n⚠️  {table_name} (表不存在)")
    
    print("\n" + "=" * 80)
    print(" 📝 总结")
    print("=" * 80)
    
    # 统计关键表数据
    critical_count = 0
    for table_name in CRITICAL_TABLES.keys():
        if table_name in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            critical_count += cursor.fetchone()[0]
    
    # 统计可清理表数据
    cleanup_count = 0
    for table_name in CLEANUP_TABLES.keys():
        if table_name in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            cleanup_count += cursor.fetchone()[0]
    
    print(f"\n✅ 系统关键数据：{len(CRITICAL_TABLES)} 个表，共 {critical_count} 行")
    print(f"🗑️  可清理数据：{len(CLEANUP_TABLES)} 个表，共 {cleanup_count} 行")
    
    print("\n" + "=" * 80)
    print(" 💡 建议操作")
    print("=" * 80)
    print("""
1. 如果要清理从 SQL 文件导入的表结构数据：
   python cleanup_sqlite_data.py --execute

2. 清理脚本只会删除以下表的数据：
   - database_tables
   - table_columns
   - table_relations
   - sql_queries
   - query_history

3. 以下关键表的数据【绝对不会被删除】：
   ✅ users - 用户账户
   ✅ knowledge_bases - 知识库
   ✅ documents - 文档记录
   ✅ document_chunks - 文档分块和向量
   ✅ system_configs - 系统配置

4. 清理后不影响：
   ✅ 用户登录和权限
   ✅ 已创建的知识库
   ✅ 已上传的文档
   ✅ RAG 向量检索功能
   ✅ Milvus/AI 配置

5. 清理后需要重新：
   ⚠️ 导入 SQL 文件到知识库（用于表结构查询）
   ⚠️ 保存常用的 SQL 查询
    """)
    
    conn.close()
    print("=" * 80)


if __name__ == "__main__":
    check_database()
