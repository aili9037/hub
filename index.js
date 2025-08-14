// Enhanced Image Handler Plugin for SillyTavern
// Prevents direct base64 conversion in beautified UI

class EnhancedImageHandler {
    constructor() {
        this.pluginName = 'Enhanced Image Handler';
        this.version = '1.0.0';
        this.imageCache = new Map();
        this.observers = [];
        this.init();
    }

    init() {
        console.log(`${this.pluginName} v${this.version} initializing...`);
        this.setupImageInterception();
        this.setupMutationObserver();
        this.setupEventListeners();
        console.log(`${this.pluginName} initialized successfully`);
    }

    // 核心功能：拦截图片处理
    setupImageInterception() {
        // 拦截原生的图片处理函数
        const originalCreateElement = document.createElement;
        document.createElement = (tagName) => {
            const element = originalCreateElement.call(document, tagName);

            if (tagName.toLowerCase() === 'img') {
                this.enhanceImageElement(element);
            }

            return element;
        };

        // 拦截FileReader的base64转换
        const originalFileReader = window.FileReader;
        window.FileReader = function() {
            const reader = new originalFileReader();
            const originalReadAsDataURL = reader.readAsDataURL;

            reader.readAsDataURL = function(file) {
                // 检查是否在美化界面中
                if (this.isInBeautifiedUI()) {
                    // 使用URL.createObjectURL代替base64
                    const objectURL = URL.createObjectURL(file);
                    this.handleImageWithObjectURL(objectURL, file);
                    return;
                }

                return originalReadAsDataURL.call(this, file);
            }.bind(this);

            return reader;
        };
    }

    // 增强图片元素
    enhanceImageElement(imgElement) {
        const originalSetSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set;

        Object.defineProperty(imgElement, 'src', {
            set: function(value) {
                if (this.shouldPreventBase64Conversion(value)) {
                    // 如果是base64，尝试转换为blob URL
                    if (value.startsWith('data:image/')) {
                        const blobUrl = this.convertBase64ToBlob(value);
                        if (blobUrl) {
                            originalSetSrc.call(this, blobUrl);
                            return;
                        }
                    }
                }
                originalSetSrc.call(this, value);
            }.bind(this),
            get: function() {
                return this.getAttribute('src');
            }
        });
    }

    // 检查是否在美化界面中
    isInBeautifiedUI() {
        // 检查当前上下文是否在美化界面中
        const beautifiedContainers = document.querySelectorAll('[class*="beautified"], [class*="enhanced"], .message-body');
        return beautifiedContainers.length > 0;
    }

    // 判断是否应该阻止base64转换
    shouldPreventBase64Conversion(src) {
        if (!src || typeof src !== 'string') return false;

        // 检查是否是base64图片且在美化界面中
        return src.startsWith('data:image/') && this.isInBeautifiedUI();
    }

    // 将base64转换为Blob URL
    convertBase64ToBlob(base64) {
        try {
            const [header, data] = base64.split(',');
            const mimeMatch = header.match(/data:([^;]+)/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/png';

            const byteCharacters = atob(data);
            const byteNumbers = new Array(byteCharacters.length);

            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mime });

            const blobUrl = URL.createObjectURL(blob);

            // 缓存blob URL以便后续清理
            this.imageCache.set(blobUrl, blob);

            return blobUrl;
        } catch (error) {
            console.warn(`${this.pluginName}: Failed to convert base64 to blob:`, error);
            return null;
        }
    }

    // 使用Object URL处理图片
    handleImageWithObjectURL(objectURL, file) {
        // 创建自定义事件来通知图片已准备就绪
        const event = new CustomEvent('imageReady', {
            detail: {
                url: objectURL,
                file: file,
                type: 'objectURL'
            }
        });

        document.dispatchEvent(event);
    }

    // 设置变化监听器
    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.processNewElement(node);
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.observers.push(observer);
    }

    // 处理新添加的元素
    processNewElement(element) {
        // 处理新添加的图片元素
        const images = element.querySelectorAll ? element.querySelectorAll('img') : [];
        images.forEach(img => this.enhanceImageElement(img));

        // 如果元素本身是图片
        if (element.tagName === 'IMG') {
            this.enhanceImageElement(element);
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        // 监听图片加载事件
        document.addEventListener('imageReady', (event) => {
            console.log(`${this.pluginName}: Image ready with Object URL`, event.detail);
        });

        // 监听页面卸载，清理blob URLs
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // 定期清理未使用的blob URLs
        setInterval(() => {
            this.cleanupUnusedBlobs();
        }, 300000); // 每5分钟清理一次
    }

    // 清理未使用的blob URLs
    cleanupUnusedBlobs() {
        const currentImages = document.querySelectorAll('img');
        const usedUrls = new Set();

        currentImages.forEach(img => {
            if (img.src && img.src.startsWith('blob:')) {
                usedUrls.add(img.src);
            }
        });

        this.imageCache.forEach((blob, url) => {
            if (!usedUrls.has(url)) {
                URL.revokeObjectURL(url);
                this.imageCache.delete(url);
            }
        });
    }

    // 清理资源
    cleanup() {
        // 清理所有blob URLs
        this.imageCache.forEach((blob, url) => {
            URL.revokeObjectURL(url);
        });
        this.imageCache.clear();

        // 清理观察器
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }

    // 获取插件状态
    getStatus() {
        return {
            name: this.pluginName,
            version: this.version,
            cachedImages: this.imageCache.size,
            isActive: true
        };
    }
}

// SillyTavern插件接口
const plugin = {
    name: 'Enhanced Image Handler',
    version: '1.0.0',

    init: function() {
        window.enhancedImageHandler = new EnhancedImageHandler();
        return true;
    },

    cleanup: function() {
        if (window.enhancedImageHandler) {
            window.enhancedImageHandler.cleanup();
            delete window.enhancedImageHandler;
        }
    },

    getStatus: function() {
        return window.enhancedImageHandler ? window.enhancedImageHandler.getStatus() : null;
    }
};

// 导出插件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = plugin;
} else {
    // 在SillyTavern环境中自动初始化
    if (typeof window !== 'undefined') {
        plugin.init();
    }
}
