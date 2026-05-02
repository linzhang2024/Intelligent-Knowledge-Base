-- 示例数据库表结构
-- 用于测试SQL文件上传和解析功能

-- 用户表
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    email VARCHAR(100) NOT NULL UNIQUE COMMENT '邮箱地址',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    phone VARCHAR(20) COMMENT '手机号码',
    avatar_url VARCHAR(500) COMMENT '头像URL',
    status VARCHAR(20) DEFAULT 'active' COMMENT '用户状态: active/inactive/banned',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP NULL COMMENT '删除时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户信息表';

-- 角色表
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '角色ID',
    name VARCHAR(50) NOT NULL UNIQUE COMMENT '角色名称',
    description VARCHAR(255) COMMENT '角色描述',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- 用户角色关联表
CREATE TABLE user_roles (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '关联ID',
    user_id INT NOT NULL COMMENT '用户ID',
    role_id INT NOT NULL COMMENT '角色ID',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '分配时间',
    assigned_by INT COMMENT '分配人ID',
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_role (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表';

-- 产品分类表
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '分类ID',
    name VARCHAR(100) NOT NULL COMMENT '分类名称',
    parent_id INT NULL COMMENT '父分类ID',
    level INT DEFAULT 1 COMMENT '分类层级',
    sort_order INT DEFAULT 0 COMMENT '排序顺序',
    icon VARCHAR(255) COMMENT '分类图标',
    description TEXT COMMENT '分类描述',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品分类表';

-- 产品表
CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '产品ID',
    category_id INT NOT NULL COMMENT '分类ID',
    name VARCHAR(200) NOT NULL COMMENT '产品名称',
    sku VARCHAR(50) UNIQUE COMMENT '库存单位',
    barcode VARCHAR(50) COMMENT '条形码',
    brand VARCHAR(100) COMMENT '品牌',
    model VARCHAR(100) COMMENT '型号',
    description TEXT COMMENT '产品描述',
    short_description VARCHAR(500) COMMENT '简短描述',
    price DECIMAL(10, 2) NOT NULL DEFAULT 0 COMMENT '销售价格',
    cost_price DECIMAL(10, 2) DEFAULT 0 COMMENT '成本价格',
    original_price DECIMAL(10, 2) COMMENT '原价',
    stock INT DEFAULT 0 COMMENT '库存数量',
    min_stock INT DEFAULT 0 COMMENT '最低库存警告',
    max_stock INT DEFAULT 99999 COMMENT '最大库存',
    unit VARCHAR(20) DEFAULT '个' COMMENT '单位',
    weight DECIMAL(10, 2) COMMENT '重量(kg)',
    length DECIMAL(10, 2) COMMENT '长度(cm)',
    width DECIMAL(10, 2) COMMENT '宽度(cm)',
    height DECIMAL(10, 2) COMMENT '高度(cm)',
    images JSON COMMENT '产品图片列表',
    main_image VARCHAR(500) COMMENT '主图URL',
    is_featured BOOLEAN DEFAULT FALSE COMMENT '是否推荐',
    is_new BOOLEAN DEFAULT FALSE COMMENT '是否新品',
    is_hot BOOLEAN DEFAULT FALSE COMMENT '是否热销',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active/inactive/draft',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    sale_count INT DEFAULT 0 COMMENT '销售次数',
    rating DECIMAL(3, 2) DEFAULT 5.00 COMMENT '评分',
    review_count INT DEFAULT 0 COMMENT '评论数',
    published_at TIMESTAMP NULL COMMENT '上架时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at TIMESTAMP NULL COMMENT '删除时间',
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品表';

-- 订单表
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '订单ID',
    order_no VARCHAR(50) NOT NULL UNIQUE COMMENT '订单编号',
    user_id INT NOT NULL COMMENT '用户ID',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '订单状态: pending/paying/paid/shipped/completed/cancelled/refunded',
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT '商品总价',
    shipping_fee DECIMAL(10, 2) DEFAULT 0 COMMENT '运费',
    discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT '优惠金额',
    tax_amount DECIMAL(10, 2) DEFAULT 0 COMMENT '税费',
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT '订单总金额',
    paid_amount DECIMAL(12, 2) DEFAULT 0 COMMENT '已支付金额',
    refund_amount DECIMAL(12, 2) DEFAULT 0 COMMENT '已退款金额',
    payment_method VARCHAR(50) COMMENT '支付方式',
    payment_time TIMESTAMP NULL COMMENT '支付时间',
    shipping_method VARCHAR(50) COMMENT '配送方式',
    shipping_time TIMESTAMP NULL COMMENT '发货时间',
    delivery_time TIMESTAMP NULL COMMENT '收货时间',
    receiver_name VARCHAR(100) NOT NULL COMMENT '收货人姓名',
    receiver_phone VARCHAR(20) NOT NULL COMMENT '收货人电话',
    receiver_address VARCHAR(500) NOT NULL COMMENT '收货地址',
    receiver_province VARCHAR(50) COMMENT '省份',
    receiver_city VARCHAR(50) COMMENT '城市',
    receiver_district VARCHAR(50) COMMENT '区县',
    receiver_zip VARCHAR(20) COMMENT '邮编',
    customer_remark TEXT COMMENT '客户备注',
    admin_remark TEXT COMMENT '管理员备注',
    coupon_id INT COMMENT '优惠券ID',
    invoice_type VARCHAR(20) COMMENT '发票类型',
    invoice_title VARCHAR(200) COMMENT '发票抬头',
    invoice_tax_no VARCHAR(50) COMMENT '税号',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    cancelled_at TIMESTAMP NULL COMMENT '取消时间',
    cancelled_reason VARCHAR(500) COMMENT '取消原因',
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- 订单明细表
CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '明细ID',
    order_id INT NOT NULL COMMENT '订单ID',
    product_id INT NOT NULL COMMENT '产品ID',
    product_name VARCHAR(200) NOT NULL COMMENT '产品名称',
    product_sku VARCHAR(50) COMMENT '产品SKU',
    product_image VARCHAR(500) COMMENT '产品图片',
    quantity INT NOT NULL DEFAULT 1 COMMENT '购买数量',
    unit_price DECIMAL(10, 2) NOT NULL COMMENT '单价',
    subtotal DECIMAL(12, 2) NOT NULL COMMENT '小计',
    discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT '优惠金额',
    actual_price DECIMAL(12, 2) NOT NULL COMMENT '实际价格',
    specifications JSON COMMENT '规格信息',
    is_reviewed BOOLEAN DEFAULT FALSE COMMENT '是否已评价',
    review_id INT COMMENT '评价ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表';

-- 添加索引优化
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_order_no ON orders(order_no);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
