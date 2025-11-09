/**
 * Catalog管理API
 * 艹，这个API必须支持所有类型的CRUD操作，还要能联动查询！
 *
 * @author 老王
 */

import { NextRequest, NextResponse } from 'next/server';

// 模拟数据库数据
let mockStyles = [
  {
    id: 'style_001',
    name: '经典T恤',
    code: 'TSH-001',
    category: '上装',
    description: '基础款经典T恤，适合日常穿着',
    season: '四季',
    designer: '设计团队A',
    status: 'active',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-03T09:30:00Z',
    colorways: [],
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tshirt1'
  }
];

let mockColorways = [
  {
    id: 'color_001',
    name: '海军蓝',
    code: 'NV-001',
    primaryColor: '#000080',
    secondaryColors: ['#191970', '#4169E1'],
    materials: ['纯棉', '氨纶'],
    images: ['https://picsum.photos/200/200?random=1'],
    status: 'active',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-03T09:30:00Z'
  }
];

let mockSizes = [
  {
    id: 'size_001',
    name: 'S',
    code: 'S-001',
    category: '上装',
    measurements: {
      chest: 96,
      waist: 80,
      hips: 96,
      length: 66,
      sleeve: 60
    },
    fit: '修身',
    status: 'active',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-03T09:30:00Z'
  }
];

let mockFabrics = [
  {
    id: 'fabric_001',
    name: '纯棉针织',
    code: 'COT-KN-001',
    type: '针织',
    composition: '100%纯棉',
    weight: 180,
    properties: ['透气', '柔软', '吸湿'],
    care: ['冷水洗涤', '低温烘干', '不可漂白'],
    status: 'active',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-03T09:30:00Z'
  }
];

let mockArtworks = [
  {
    id: 'art_001',
    name: '品牌Logo',
    code: 'LOGO-001',
    type: 'logo',
    category: '品牌标识',
    images: ['https://picsum.photos/200/200?random=10'],
    description: '官方品牌标识图案',
    usage: ['胸贴', '领标', '洗水标'],
    restrictions: ['不可修改比例', '不可变色'],
    status: 'active',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-03T09:30:00Z'
  }
];

// 根据类型获取数据
function getDataByType(type: string) {
  switch (type) {
    case 'styles':
      return mockStyles;
    case 'colorways':
      return mockColorways;
    case 'sizes':
      return mockSizes;
    case 'fabrics':
      return mockFabrics;
    case 'artworks':
      return mockArtworks;
    default:
      return [];
  }
}

// 根据类型设置数据
function setDataByType(type: string, data: any[]) {
  switch (type) {
    case 'styles':
      mockStyles = data;
      break;
    case 'colorways':
      mockColorways = data;
      break;
    case 'sizes':
      mockSizes = data;
      break;
    case 'fabrics':
      mockFabrics = data;
      break;
    case 'artworks':
      mockArtworks = data;
      break;
  }
}

// GET - 获取列表
export async function GET(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  const { type } = params;
  const { searchParams } = new URL(request.url);

  try {
    const data = getDataByType(type);

    // 支持分页和搜索
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    let filteredData: any[] = data as any[];

    // 搜索过滤
    if (search) {
      filteredData = filteredData.filter((item: any) =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase())
      );
    }

    // 状态过滤
    if (status) {
      filteredData = filteredData.filter((item: any) => item.status === status);
    }

    // 分类过滤
    if (category) {
      filteredData = filteredData.filter((item: any) => item.category === category);
    }

    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    return NextResponse.json({
      data: paginatedData,
      pagination: {
        total: filteredData.length,
        page,
        limit,
        totalPages: Math.ceil(filteredData.length / limit)
      }
    });

  } catch (error) {
    console.error(`Failed to fetch ${type}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch ${type}` },
      { status: 500 }
    );
  }
}

// POST - 创建新记录
export async function POST(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  const { type } = params;

  try {
    const body = await request.json();
    const data = getDataByType(type);

    const newRecord = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.push(newRecord);
    setDataByType(type, data);

    console.log(`Created new ${type}:`, newRecord.id);

    return NextResponse.json({
      data: newRecord,
      message: `${type} created successfully`
    }, { status: 201 });

  } catch (error) {
    console.error(`Failed to create ${type}:`, error);
    return NextResponse.json(
      { error: `Failed to create ${type}` },
      { status: 500 }
    );
  }
}

// PUT - 更新记录
export async function PUT(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  const { type } = params;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'ID is required for update' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const data = getDataByType(type);

    const index = data.findIndex((item: any) => item.id === id);
    if (index === -1) {
      return NextResponse.json(
        { error: `${type} not found` },
        { status: 404 }
      );
    }

    const updatedRecord = {
      ...data[index],
      ...body,
      updatedAt: new Date().toISOString()
    };

    data[index] = updatedRecord;
    setDataByType(type, data);

    console.log(`Updated ${type}:`, id);

    return NextResponse.json({
      data: updatedRecord,
      message: `${type} updated successfully`
    });

  } catch (error) {
    console.error(`Failed to update ${type}:`, error);
    return NextResponse.json(
      { error: `Failed to update ${type}` },
      { status: 500 }
    );
  }
}

// DELETE - 删除记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  const { type } = params;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'ID is required for delete' },
      { status: 400 }
    );
  }

  try {
    const data = getDataByType(type);

    const index = data.findIndex((item: any) => item.id === id);
    if (index === -1) {
      return NextResponse.json(
        { error: `${type} not found` },
        { status: 404 }
      );
    }

    const deletedRecord = data[index];
    data.splice(index, 1);
    setDataByType(type, data);

    console.log(`Deleted ${type}:`, id);

    return NextResponse.json({
      data: deletedRecord,
      message: `${type} deleted successfully`
    });

  } catch (error) {
    console.error(`Failed to delete ${type}:`, error);
    return NextResponse.json(
      { error: `Failed to delete ${type}` },
      { status: 500 }
    );
  }
}
