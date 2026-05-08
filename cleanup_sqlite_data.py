#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
清理 SQLite 数据库中错误导入的 SQL 表结构数据

由于之前的代码错误地将上传的 SQL 文件内容导入了关系数据库，
此脚本用于删除这些与系统无关的表结构数据。

保留的数据：
- 系统自身的表结构（users, documents, knowledge_bases 等 prisma schema 中的表）
- 系统配置表

删除的数据：
- 从上传的 SQL 文件中解析并导入的表结构（database_tables, table_columns, table_relations）
- SQL 查询历史（sql_queries, query_history）
"""

import sqlite3
import os
import sys

# 设置控制台编码为 UTF-8
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# 数据库文件路径
DB_PATH = "prisma/dev.db"

# 系统自身的表（这些是 prisma schema 中定义的表，需要保留）
SYSTEM_TABLES = {
    'users',
    'knowledge_bases', 
    'documents',
    'document_chunks',
    'system_configs',
    'ai_configs',
    'rag_configs',
    'milvus_configs',
    'storage_configs',
    'upload_sessions',
    'split_upload_progresses',
    # 以下是要清理的表，但先列出来
    # 'database_tables',
    # 'table_columns',
    # 'table_relations',
    # 'sql_queries',
    # 'query_history',
}

# 需要清空的表（从 SQL 文件导入的表结构数据）
TABLES_TO_CLEANUP = [
    'database_tables',
    'table_columns',
    'table_relations',
    'sql_queries',
    'query_history',
]


def get_table_count(cursor, table_name: str) -> int:
    """获取表中的数据行数"""
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        result = cursor.fetchone()
        return result[0] if result else 0
    except sqlite3.Error:
        return 0


def get_sample_data(cursor, table_name: str, limit: int = 5) -> list:
    """获取表的示例数据"""
    try:
        cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit}")
        return cursor.fetchall()
    except sqlite3.Error:
        return []


def get_table_columns(cursor, table_name: str) -> list:
    """获取表的列信息"""
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        return cursor.fetchall()
    except sqlite3.Error:
        return []


def cleanup_database(db_path: str, dry_run: bool = True):
    """
    清理数据库
    
    Args:
        db_path: 数据库文件路径
        dry_run: 如果为 True，只显示将要执行的操作，不实际删除
    """
    if not os.path.exists(db_path):
        print(f"❌ 数据库文件不存在：{db_path}")
        return
    
    print(f"📊 连接到数据库：{db_path}")
    print("=" * 80)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 获取所有表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        all_tables = [row[0] for row in cursor.fetchall()]
        
        print(f"📋 数据库中共有 {len(all_tables)} 个表\n")
        
        # 统计信息
        total_rows_to_delete = 0
        tables_with_data = []
        
        # 检查每个需要清理的表
        for table_name in TABLES_TO_CLEANUP:
            if table_name in all_tables:
                count = get_table_count(cursor, table_name)
                if count > 0:
                    tables_with_data.append({
                        'name': table_name,
                        'count': count
                    })
                    total_rows_to_delete += count
                    print(f"📊 表 {table_name}: {count} 行数据")
                    
                    # 显示示例数据
                    sample_data = get_sample_data(cursor, table_name, 3)
                    if sample_data:
                        columns = get_table_columns(cursor, table_name)
                        col_names = [col[1] for col in columns]
                        print(f"   列：{', '.join(col_names)}")
                        print(f"   示例数据:")
                        for i, row in enumerate(sample_data, 1):
                            # 只显示关键信息，避免输出太长
                            if table_name == 'database_tables':
                                # database_tables: id, name, schemaName, tableComment, knowledgeBaseId, documentId
                                if len(row) >= 4:
                                    print(f"     {i}. 表名={row[1]}, 注释={row[3][:50] if row[3] else 'None'}...")
                            elif table_name == 'table_columns':
                                # table_columns: id, tableId, name, dataType, columnComment, ...
                                if len(row) >= 4:
                                    print(f"     {i}. 字段名={row[2]}, 类型={row[3]}")
                            elif table_name == 'table_relations':
                                # table_relations: fromTableId, fromColumnName, toTableId, toColumnName, relationType
                                if len(row) >= 5:
                                    print(f"     {i}. {row[2]}.{row[3]} -> {row[4]}.{row[5]} ({row[6]})")
                            else:
                                print(f"     {i}. {row}")
                        print()
            else:
                print(f"⚠️  表 {table_name} 不存在")
        
        print("=" * 80)
        print(f"📈 统计：共 {len(tables_with_data)} 个表需要清理，总计 {total_rows_to_delete} 行数据\n")
        
        if total_rows_to_delete == 0:
            print("✅ 数据库已经很干净，无需清理")
            return
        
        if dry_run:
            print("🔍 这是预演模式（dry-run），不会实际删除数据")
            print("💡 如需实际删除，请运行：python cleanup_sqlite_data.py --execute\n")
            print("将要执行的操作:")
            for table_info in tables_with_data:
                print(f"  DELETE FROM {table_info['name']} ({table_info['count']} 行)")
        else:
            print("⚠️  警告：即将删除数据，此操作不可逆！\n")
            
            # 确认删除
            confirm = input("确认要删除这些数据吗？(输入 yes 确认): ")
            if confirm.lower() != 'yes':
                print("❌ 操作已取消")
                return
            
            print("\n🗑️  开始删除数据...\n")
            
            # 禁用外键约束（避免外键冲突）
            cursor.execute("PRAGMA foreign_keys = OFF")
            
            # 删除数据（按顺序，先删除依赖表）
            delete_order = ['table_relations', 'table_columns', 'database_tables', 'sql_queries', 'query_history']
            
            for table_name in delete_order:
                if table_name in TABLES_TO_CLEANUP:
                    try:
                        cursor.execute(f"DELETE FROM {table_name}")
                        deleted_count = cursor.rowcount
                        print(f"✅ 已删除 {table_name}: {deleted_count} 行")
                    except sqlite3.Error as e:
                        print(f"❌ 删除 {table_name} 失败：{e}")
            
            # 重新启用外键约束
            cursor.execute("PRAGMA foreign_keys = ON")
            
            # 提交事务
            conn.commit()
            
            print("\n✅ 数据清理完成！")
            
            # 验证清理结果
            print("\n📊 验证清理结果:")
            remaining_rows = 0
            for table_name in TABLES_TO_CLEANUP:
                if table_name in all_tables:
                    count = get_table_count(cursor, table_name)
                    remaining_rows += count
                    status = "✅" if count == 0 else "⚠️"
                    print(f"  {status} {table_name}: {count} 行")
            
            if remaining_rows == 0:
                print("\n🎉 所有数据已成功清理！")
            else:
                print(f"\n⚠️  仍有 {remaining_rows} 行数据未清理")
    
    except sqlite3.Error as e:
        print(f"❌ 数据库错误：{e}")
    finally:
        conn.close()
        print("\n" + "=" * 80)
        print("数据库连接已关闭")


def main():
    import sys
    
    print("=" * 80)
    print(" SQLite 数据库清理工具")
    print(" 用于删除错误导入的 SQL 表结构数据")
    print("=" * 80)
    print()
    
    # 检查命令行参数
    dry_run = True
    if len(sys.argv) > 1:
        if sys.argv[1] == '--execute' or sys.argv[1] == '-e':
            dry_run = False
        elif sys.argv[1] == '--help' or sys.argv[1] == '-h':
            print("用法：python cleanup_sqlite_data.py [选项]")
            print()
            print("选项:")
            print("  --execute, -e    实际执行删除操作（默认是预演模式）")
            print("  --help, -h       显示帮助信息")
            print()
            print("示例:")
            print("  python cleanup_sqlite_data.py           # 预演模式，只显示将要删除的数据")
            print("  python cleanup_sqlite_data.py --execute # 实际执行删除")
            return
    
    # 检查数据库文件
    if not os.path.exists(DB_PATH):
        print(f"❌ 数据库文件不存在：{DB_PATH}")
        print(f"💡 请确保在项目根目录运行此脚本")
        return
    
    # 执行清理
    cleanup_database(DB_PATH, dry_run=dry_run)


if __name__ == "__main__":
    main()
