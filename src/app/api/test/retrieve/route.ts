import { NextRequest, NextResponse } from 'next/server';
import { vectorStoreService } from '@/lib/vectorStore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { message: 'query 参数不能为空' },
        { status: 400 }
      );
    }

    const results = await vectorStoreService.search(query, 3);

    return NextResponse.json(
      {
        message: '检索成功',
        query: query,
        results: results.map((result) => ({
          id: result.id,
          content: result.content,
          metadata: result.metadata,
          score: result.score,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('检索失败:', error);
    return NextResponse.json(
      { message: '检索失败，请稍后重试', error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documents } = body;

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { message: 'documents 参数不能为空' },
        { status: 400 }
      );
    }

    await vectorStoreService.addDocuments(documents);

    return NextResponse.json(
      {
        message: '文档添加成功',
        count: documents.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('添加文档失败:', error);
    return NextResponse.json(
      { message: '添加文档失败，请稍后重试', error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await vectorStoreService.clearCollection();

    return NextResponse.json(
      {
        message: '向量数据库已清空',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('清空数据库失败:', error);
    return NextResponse.json(
      { message: '清空数据库失败，请稍后重试', error: (error as Error).message },
      { status: 500 }
    );
  }
}
