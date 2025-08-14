(() => {
    'use strict';

    const MODULE_NAME = 'stable-image-uploader';
    const DEBUG = true;

    // 配置选项
    let config = {
        apiUrl: 'https://api.imgbb.com/1/upload',
        apiKey: '',
        maxFileSize: 32 * 1024 * 1024, // 32MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        timeout: 30000,
        retryCount: 3,
        retryDelay: 1000
    };

    // 日志函数
    function log(message, level = 'info') {
        if (DEBUG) {
            console.log(`[${MODULE_NAME}] ${level.toUpperCase()}: ${message}`);
        }
    }

    // 错误处理函数
    function handleError(error, context = '') {
        log(`错误 ${context}: ${error.message}`, 'error');
        toastr.error(`图片上传失败: ${error.message}`, '上传错误');
        return null;
    }

    // 文件验证函数
    function validateFile(file) {
        if (!file) {
            throw new Error('未选择文件');
        }

        if (file.size > config.maxFileSize) {
            throw new Error(`文件大小超过限制 (${(config.maxFileSize / 1024 / 1024).toFixed(1)}MB)`);
        }

        if (!config.allowedTypes.includes(file.type)) {
            throw new Error('不支持的文件类型');
        }

        return true;
    }

    // 延迟函数
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 图片压缩函数
    function compressImage(file, maxWidth = 1920, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = function() {
                const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(resolve, file.type, quality);
            };

            img.src = URL.createObjectURL(file);
        });
    }

    // 主要上传函数
    async function uploadImage(file, retryCount = 0) {
        try {
            validateFile(file);

            // 如果文件过大，尝试压缩
            if (file.size > 5 * 1024 * 1024) {
                log('文件较大，正在压缩...');
                file = await compressImage(file);
            }

            const formData = new FormData();
            formData.append('image', file);

            if (config.apiKey) {
                formData.append('key', config.apiKey);
            }

            log(`开始上传图片，尝试次数: ${retryCount + 1}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.timeout);

            const response = await fetch(config.apiUrl, {
                method: 'POST',
                body: formData,
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success && result.data && result.data.url) {
                log('图片上传成功');
                toastr.success('图片上传成功！', '上传完成');
                return result.data.url;
            } else {
                throw new Error(result.error?.message || '上传服务返回错误');
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                error.message = '上传超时';
            }

            if (retryCount < config.retryCount) {
                log(`上传失败，${config.retryDelay}ms后重试...`);
                await delay(config.retryDelay);
                return uploadImage(file, retryCount + 1);
            }

            return handleError(error, '上传过程中');
        }
    }

    // 创建UI界面
    function createUI() {
        const html = `
            <div id="image-uploader-container" class="flex-container flexFlowColumn">
                <div class="justifyCenter">
                    <h3>稳定图片上传器</h3>
                </div>

                <div class="flex-container">
                    <label for="image-upload-input" class="menu_button" style="cursor: pointer;">
                        <i class="fa fa-upload"></i> 选择图片
                    </label>
                    <input type="file" id="image-upload-input" accept="image/*" style="display: none;">
                </div>

                <div class="flex-container" style="margin-top: 10px;">
                    <label for="api-key-input">API密钥:</label>
                    <input type="password" id="api-key-input" placeholder="输入图床API密钥" style="flex: 1; margin-left: 10px;">
                </div>

                <div class="flex-container" style="margin-top: 10px;">
                    <select id="service-select" style="flex: 1;">
                        <option value="https://api.imgbb.com/1/upload">ImgBB</option>
                        <option value="https://sm.ms/api/v2/upload">SM.MS</option>
                        <option value="custom">自定义服务</option>
                    </select>
                </div>

                <div id="upload-progress" style="display: none; margin-top: 10px;">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <span class="progress-text">上传中...</span>
                </div>

                <div id="upload-result" style="margin-top: 10px; display: none;">
                    <textarea id="result-url" readonly style="width: 100%; height: 60px;"></textarea>
                    <button id="copy-url-btn" class="menu_button" style="margin-top: 5px;">
                        <i class="fa fa-copy"></i> 复制链接
                    </button>
                </div>
            </div>

            <style>
                #image-uploader-container {
                    padding: 15px;
                    border: 1px solid var(--SmartThemeBorderColor);
                    border-radius: 10px;
                    background: var(--SmartThemeBodyColor);
                    margin: 10px 0;
                }

                .progress-bar {
                    width: 100%;
                    height: 20px;
                    background-color: var(--SmartThemeQuoteColor);
                    border-radius: 10px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #4CAF50, #45a049);
                    width: 0%;
                    transition: width 0.3s ease;
                    animation: pulse 1.5s infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.7; }
                    100% { opacity: 1; }
                }

                .progress-text {
                    display: block;
                    text-align: center;
                    margin-top: 5px;
                    font-size: 12px;
                    color: var(--SmartThemeBodyColor);
                }
            </style>
        `;

        return html;
    }

    // 绑定事件
    function bindEvents() {
        const fileInput = document.getElementById('image-upload-input');
        const apiKeyInput = document.getElementById('api-key-input');
        const serviceSelect = document.getElementById('service-select');
        const copyBtn = document.getElementById('copy-url-btn');
        const progressDiv = document.getElementById('upload-progress');
        const resultDiv = document.getElementById('upload-result');
        const resultTextarea = document.getElementById('result-url');

        // 文件选择事件
        fileInput?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                // 显示进度条
                progressDiv.style.display = 'block';
                resultDiv.style.display = 'none';

                const url = await uploadImage(file);

                if (url) {
                    resultTextarea.value = url;
                    resultDiv.style.display = 'block';

                    // 自动插入到聊天输入框
                    const chatInput = document.getElementById('send_textarea');
                    if (chatInput) {
                        const currentValue = chatInput.value;
                        chatInput.value = currentValue + (currentValue ? '\n' : '') + url;
                        chatInput.focus();
                    }
                }
            } catch (error) {
                handleError(error, '文件处理');
            } finally {
                progressDiv.style.display = 'none';
                fileInput.value = '';
            }
        });

        // API密钥输入事件
        apiKeyInput?.addEventListener('input', (e) => {
            config.apiKey = e.target.value.trim();
            localStorage.setItem(`${MODULE_NAME}_apiKey`, config.apiKey);
        });

        // 服务选择事件
        serviceSelect?.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value !== 'custom') {
                config.apiUrl = value;
            } else {
                const customUrl = prompt('请输入自定义API地址:');
                if (customUrl) {
                    config.apiUrl = customUrl;
                }
            }
            localStorage.setItem(`${MODULE_NAME}_apiUrl`, config.apiUrl);
        });

        // 复制按钮事件
        copyBtn?.addEventListener('click', () => {
            resultTextarea.select();
            document.execCommand('copy');
            toastr.success('链接已复制到剪贴板', '复制成功');
        });

        // 拖拽上传支持
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', async (e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            const imageFile = files.find(file => file.type.startsWith('image/'));

            if (imageFile) {
                try {
                    progressDiv.style.display = 'block';
                    resultDiv.style.display = 'none';

                    const url = await uploadImage(imageFile);

                    if (url) {
                        resultTextarea.value = url;
                        resultDiv.style.display = 'block';

                        const chatInput = document.getElementById('send_textarea');
                        if (chatInput) {
                            const currentValue = chatInput.value;
                            chatInput.value = currentValue + (currentValue ? '\n' : '') + url;
                            chatInput.focus();
                        }
                    }
                } catch (error) {
                    handleError(error, '拖拽上传');
                } finally {
                    progressDiv.style.display = 'none';
                }
            }
        });
    }

    // 加载保存的配置
    function loadConfig() {
        const savedApiKey = localStorage.getItem(`${MODULE_NAME}_apiKey`);
        const savedApiUrl = localStorage.getItem(`${MODULE_NAME}_apiUrl`);

        if (savedApiKey) {
            config.apiKey = savedApiKey;
        }
        if (savedApiUrl) {
            config.apiUrl = savedApiUrl;
        }
    }

    // 插件初始化
    function init() {
        log('插件初始化开始');

        loadConfig();

        // 添加到扩展面板
        const extensionsContainer = document.getElementById('extensions_settings');
        if (extensionsContainer) {
            const pluginDiv = document.createElement('div');
            pluginDiv.innerHTML = createUI();
            extensionsContainer.appendChild(pluginDiv);

            // 延迟绑定事件，确保DOM完全加载
            setTimeout(() => {
                bindEvents();

                // 恢复保存的配置到UI
                const apiKeyInput = document.getElementById('api-key-input');
                const serviceSelect = document.getElementById('service-select');

                if (apiKeyInput && config.apiKey) {
                    apiKeyInput.value = config.apiKey;
                }

                if (serviceSelect) {
                    serviceSelect.value = config.apiUrl;
                }

                log('插件初始化完成');
            }, 100);
        } else {
            log('未找到扩展设置容器，延迟初始化', 'warn');
            setTimeout(init, 1000);
        }
    }

    // 等待SillyTavern完全加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
