import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function extractKeywords(query: string): string[] {
  const cleanedQuery = query.toLowerCase().trim();
  
  if (!cleanedQuery) return [];
  
  const keywords: string[] = [];
  
  const stopWords = new Set(['如何', '怎么', '什么', '的', '了', '是', '在', '有', '和', '与', '或', '吗', '呢', '啊', '吧', '呀']);
  
  const ngrams: string[] = [];
  for (let n = 4; n >= 2; n--) {
    for (let i = 0; i <= cleanedQuery.length - n; i++) {
      const ngram = cleanedQuery.substring(i, i + n);
      if (!stopWords.has(ngram) && ngram.trim().length > 0) {
        ngrams.push(ngram);
      }
    }
  }
  
  for (const char of cleanedQuery) {
    if (!stopWords.has(char) && char.trim().length > 0 && /[\u4e00-\u9fa5a-zA-Z0-9]/.test(char)) {
      ngrams.push(char);
    }
  }
  
  const uniqueKeywords = [...new Set(ngrams)];
  
  return uniqueKeywords.sort((a, b) => b.length - a.length);
}

function calculateRelevanceScore(content: string | null, title: string, query: string): number {
  if (!content && !title) return 0;

  const keywords = extractKeywords(query);
  
  if (keywords.length === 0) return 0;

  const lowerTitle = title.toLowerCase();
  const lowerContent = (content || '').toLowerCase();
  const totalTextLength = lowerTitle.length + lowerContent.length;
  
  let totalScore = 0;
  let matchedKeywordsCount = 0;
  const matchedPositions: number[] = [];
  
  for (const keyword of keywords) {
    const titleMatches = [...lowerTitle.matchAll(new RegExp(keyword, 'g'))];
    const contentMatches = [...lowerContent.matchAll(new RegExp(keyword, 'g'))];
    
    const titleMatchCount = titleMatches.length;
    const contentMatchCount = contentMatches.length;
    const totalMatchCount = titleMatchCount + contentMatchCount;
    
    if (totalMatchCount > 0) {
      matchedKeywordsCount++;
      
      const titleWeight = 5.0;
      const contentWeight = 1.0;
      
      const keywordLengthBonus = keyword.length * 0.5;
      
      const density = totalMatchCount / Math.max(totalTextLength / 100, 1);
      const densityBonus = Math.min(density * 5, 2.0);
      
      titleMatches.forEach(m => {
        const position = m.index || 0;
        const positionBonus = Math.max(0, 1 - position / Math.max(lowerTitle.length, 1));
        matchedPositions.push(position * 0.1);
        totalScore += titleWeight * keywordLengthBonus * (1 + positionBonus * 0.3);
      });
      
      contentMatches.forEach(m => {
        const position = m.index || 0;
        const positionBonus = Math.max(0, 1 - position / Math.max(lowerContent.length, 1));
        matchedPositions.push(lowerTitle.length + position * 0.1);
        totalScore += contentWeight * keywordLengthBonus * (1 + positionBonus * 0.15);
      });
      
      totalScore += densityBonus;
    }
  }
  
  const keywordMatchRatio = keywords.length > 0 ? matchedKeywordsCount / keywords.length : 0;
  
  const consecutiveMatchBonus = calculateConsecutiveMatchBonus(lowerTitle, lowerContent, query);
  
  const maxPossibleScore = keywords.length * 10;
  const normalizedScore = Math.min(totalScore / maxPossibleScore, 1);
  
  const finalScore = normalizedScore * 0.6 + keywordMatchRatio * 0.25 + consecutiveMatchBonus * 0.15;
  
  return Math.min(Math.max(finalScore, 0), 1);
}

function calculateConsecutiveMatchBonus(title: string, content: string, query: string): number {
  const lowerQuery = query.toLowerCase();
  const fullText = `${title} ${content}`.toLowerCase();
  
  if (fullText.includes(lowerQuery)) {
    return 1.0;
  }
  
  let maxConsecutiveMatch = 0;
  const queryChars = lowerQuery.split('');
  
  for (let start = 0; start < queryChars.length; start++) {
    let currentMatch = 0;
    let textPos = 0;
    
    for (let i = start; i < queryChars.length; i++) {
      const foundPos = fullText.indexOf(queryChars[i], textPos);
      if (foundPos !== -1) {
        currentMatch++;
        textPos = foundPos + 1;
      } else {
        break;
      }
    }
    
    maxConsecutiveMatch = Math.max(maxConsecutiveMatch, currentMatch);
  }
  
  return queryChars.length > 0 ? maxConsecutiveMatch / queryChars.length : 0;
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

    const keywords = extractKeywords(query);

    let documents;
    
    if (keywords.length > 0) {
      const orConditions = [];
      
      for (const keyword of keywords.slice(0, 5)) {
        orConditions.push({ title: { contains: keyword, mode: 'insensitive' } });
        orConditions.push({ content: { contains: keyword, mode: 'insensitive' } });
      }
      
      documents = await prisma.document.findMany({
        where: {
          OR: orConditions
        },
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      if (documents.length === 0) {
        documents = await prisma.document.findMany({
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            updatedAt: true
          }
        });
      }
    } else {
      documents = await prisma.document.findMany({
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
          updatedAt: true
        }
      });
    }

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

    const filteredResults = scoredDocuments.filter(doc => doc.score > 0);
    const topResults = filteredResults.slice(0, 3);

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
