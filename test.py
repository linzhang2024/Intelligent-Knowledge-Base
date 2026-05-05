from pymilvus import MilvusClient

client = MilvusClient(
    uri="http://localhost:19530"
)

print("连接成功")

print("现有 collections:", client.list_collections())