import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function calculateRelevanceScore(content: string | null, title: string, query: string): number {
  if (!content && !title) return 0;

  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
  const fullText = `${title} ${content || ''}`.toLowerCase();
  
  let score = 0;
  let matchedWords = 0;
  
  for (const word of queryWords) {
    const titleMatches = (title.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    const contentMatches = (content?.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    const totalMatches = titleMatches + contentMatches;
    
    if (totalMatches > 0) {
      matchedWords++;
      score += titleMatches * 3 + contentMatches;
    }
  }
  
  const wordMatchRatio = queryWords.length > 0 ? matchedWords / queryWords.length : 0;
  const finalScore = score > 0 ? (0.5 + wordMatchRatio * 0.3 + Math.min(score / 100, 0.2)) : 0;
  
  return Math.min(finalScore, 1);
}

function getContentSnippet(content: string | null, query: string, maxLength: number = 200): string {
  if (!content) return '';
  
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
  let bestMatchIndex = -1;
  let bestMatchScore = 0;
  
  for (const word of queryWords) {
    const index = content.toLowerCase().indexOf(word);
    if (index !== -1) {
      const surroundingContext = content.substring(Math.max(0, index - 50), Math.min(content.length, index + word.length + 50));
      const wordMatches = (surroundingContext.toLowerCase().match(new RegExp(word, 'g')) || []).length;
      
      if (wordMatches > bestMatchScore) {
        bestMatchScore = wordMatches;
        bestMatchIndex = index;
      }
    }
  }
  
  if (bestMatchIndex === -1) {
    return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
  }
  
  const start = Math.max(0, bestMatchIndex - 80);
  const end = Math.min(content.length, bestMatchIndex + 120);
  const snippet = content.substring(start, end);
  
  return (start > 0 ? '...' : '') + snippet + (end < content.length ? '...' : '');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query || query.trim() === '') {
      return NextResponse.json(
        { message: 'query 参数不能为空' },
        { status: 400 }
      );
    }

    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const scoredDocuments = documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      contentSnippet: getContentSnippet(doc.content, query),
      score: calculateRelevanceScore(doc.content, doc.title, query),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }));

    scoredDocuments.sort((a, b) => b.score - a.score);

    const topResults = scoredDocuments.slice(0, 3);

    return NextResponse.json(
      {
        message: '检索成功',
        query: query,
        totalMatched: documents.length,
        results: topResults.map(result => ({
          id: result.id,
          title: result.title,
          contentSnippet: result.contentSnippet,
          score: result.score,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt
        }))
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
        { message: 'documents 参数不能为空，且必须是数组' },
        { status: 400 }
      );
    }

    const createdDocuments = [];

    for (const doc of documents) {
      if (!doc.title) {
        return NextResponse.json(
          { message: '每个文档必须包含 title 字段' },
          { status: 400 }
        );
      }

      const createdDoc = await prisma.document.create({
        data: {
          title: doc.title,
          content: doc.content || null,
          status: 'PUBLISHED'
        }
      });

      createdDocuments.push({
        id: createdDoc.id,
        title: createdDoc.title,
        content: createdDoc.content,
        createdAt: createdDoc.createdAt
      });
    }

    return NextResponse.json(
      {
        message: '文档添加成功',
        count: createdDocuments.length,
        documents: createdDocuments
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
    const { searchParams } = new URL(request.url);
    const docIds = searchParams.getAll('id');

    if (docIds.length > 0) {
      await prisma.document.deleteMany({
        where: {
          id: { in: docIds }
        }
      });

      return NextResponse.json(
        {
          message: `已删除 ${docIds.length} 个文档`,
          deletedIds: docIds
        },
        { status: 200 }
      );
    } else {
      const allDocs = await prisma.document.findMany({
        select: { id: true }
      });

      if (allDocs.length > 0) {
        await prisma.document.deleteMany({
          where: {
            id: { in: allDocs.map(doc => doc.id) }
          }
        });
      }

      return NextResponse.json(
        {
          message: '已清空所有测试文档',
          deletedCount: allDocs.length
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('删除文档失败:', error);
    return NextResponse.json(
      { message: '删除文档失败，请稍后重试', error: (error as Error).message },
      { status: 500 }
    );
  }
}
