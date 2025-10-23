// 悬浮球批量视频生成插件
class VideuFloatingBall {
    constructor() {
        this.isVisible = false;
        this.isProcessing = false;
        this.selectedImages = [];
        this.prompts = [];
        this.lastPrompt = '';
        this.currentTaskIndex = 0;
        this.pageType = this.detectPageType();
        this.currentMode = 'img2video'; // 默认模式
        this.settings = {
            processMode: 'queue',
            batchSize: 4,
            waitTime: 2,
            checkInterval: 8,
            maxRetries: 5,
            aspectRatio: '9:16',
            offPeakMode: true,
            generationCount: 1
        };
        
        this.init();
    }
    
    detectPageType() {
        const url = window.location.href;
        if (url.includes('/create/reference') || url.includes('/create/character2video')) {
            return 'reference';
        } else if (url.includes('/create/img2video')) {
            return 'img2video';
        }
        return 'unknown';
    }
    
    init() {
        this.loadSettings();
        this.createFloatingBall();
        this.createFloatingPanel();
        this.bindEvents();
        // 延迟更新UI，确保DOM元素已创建
        setTimeout(() => {
            this.updateUIForPageType();
        }, 100);
        console.log('Vidu悬浮球插件已初始化');
    }
    
    updateUIForPageType() {
        console.log('更新UI，当前页面类型:', this.pageType, '当前模式:', this.currentMode);
        
        const pageTypeEl = document.getElementById('vidu-page-type');
        const uploadSection = document.getElementById('vidu-upload-section');
        const referenceSection = document.getElementById('vidu-reference-section');
        const referenceActions = document.getElementById('vidu-reference-actions');
        const imageCountEl = document.getElementById('vidu-image-count');
        
        // 检查元素是否存在
        if (!pageTypeEl) {
            console.error('页面类型元素未找到');
            return;
        }
        if (!uploadSection) {
            console.error('上传区域元素未找到');
            return;
        }
        if (!referenceSection) {
            console.error('参考区域元素未找到');
            return;
        }
        
        // 更新页面类型指示器
        if (this.pageType === 'reference') {
            pageTypeEl.textContent = '当前页面：参考生视频';
            pageTypeEl.style.color = '#4CAF50';
        } else if (this.pageType === 'img2video') {
            pageTypeEl.textContent = '当前页面：图生视频';
            pageTypeEl.style.color = '#2196F3';
        } else {
            pageTypeEl.textContent = '当前页面：未知类型';
            pageTypeEl.style.color = '#FF9800';
        }
        
        // 根据用户选择的模式更新UI
        if (this.currentMode === 'reference') {
            console.log('显示参考生视频模式界面');
            uploadSection.style.display = 'none';
            referenceSection.style.display = 'block';
            if (referenceActions) referenceActions.style.display = 'none';
            if (imageCountEl) imageCountEl.style.display = 'none';
        } else if (this.currentMode === 'img2video') {
            console.log('显示图生视频模式界面');
            uploadSection.style.display = 'block';
            referenceSection.style.display = 'none';
            if (referenceActions) referenceActions.style.display = 'block';
            if (imageCountEl) imageCountEl.style.display = 'inline';
        }
        
        console.log('UI更新完成');
    }
    
    createFloatingBall() {
        this.floatingBall = document.createElement('div');
        this.floatingBall.className = 'vidu-floating-ball';
        this.floatingBall.innerHTML = `
            <svg class="vidu-floating-ball-icon" viewBox="0 0 24 24">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 21H5V3H13V9H19Z"/>
            </svg>
        `;
        
        document.body.appendChild(this.floatingBall);
    }
    
    createFloatingPanel() {
        this.floatingPanel = document.createElement('div');
        this.floatingPanel.className = 'vidu-floating-panel';
        this.floatingPanel.innerHTML = `
            <div class="vidu-panel-header">
                <div class="vidu-title-section">
                    <span>Vidu批量视频生成</span>
                    <div class="vidu-version">v3.0.0</div>
                </div>
                <button class="vidu-panel-close">×</button>
            </div>
            <div class="vidu-panel-content">
                <!-- 模式切换器 -->
                <div class="vidu-mode-selector">
                    <div class="vidu-mode-options">
                        <label class="vidu-mode-option">
                            <input type="radio" name="vidu-mode" value="img2video" id="vidu-mode-img2video" checked>
                            <span class="vidu-mode-label">图生视频模式</span>
                        </label>
                        <label class="vidu-mode-option">
                            <input type="radio" name="vidu-mode" value="reference" id="vidu-mode-reference">
                            <span class="vidu-mode-label">参考生视频模式</span>
                        </label>
                    </div>
                    <div class="vidu-page-type-indicator">
                        <span id="vidu-page-type">检测页面类型中...</span>
                    </div>
                </div>
                
                <!-- 参考生视频快速按钮 (仅在图生视频页面显示) -->
                <div class="vidu-reference-actions" id="vidu-reference-actions" style="display: none;">
                    <button class="vidu-btn vidu-btn-reference" id="vidu-reference-btn">
                        🎯 参考生视频
                    </button>
                    <div class="vidu-reference-hint">
                        点击切换到参考生视频模式，自动选定主体并批量生成
                    </div>
                </div>
                
                <!-- 图片上传区域 (仅图生视频页面显示) -->
                <div class="vidu-upload-section" id="vidu-upload-section" style="display: none;">
                    <div class="vidu-section-title">
                        📸 选择图片
                    </div>
                    <div class="vidu-upload-area" id="vidu-upload-area">
                        <svg class="vidu-upload-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        </svg>
                        <div class="vidu-upload-text">点击选择文件夹或图片</div>
                        <div class="vidu-upload-hint">支持 JPG、PNG、WebP 格式</div>
                        <div class="vidu-upload-buttons">
                            <button class="vidu-btn vidu-btn-secondary" id="vidu-select-folder">📁 选择文件夹</button>
                            <button class="vidu-btn vidu-btn-secondary" id="vidu-select-files">🖼️ 选择图片</button>
                        </div>
                        <input type="file" class="vidu-file-input" id="vidu-file-input" multiple accept="image/jpeg,image/png,image/webp">
                    </div>
                    <div class="vidu-image-preview" id="vidu-image-preview"></div>
                </div>
                
                <!-- 参考生视频说明区域 -->
                <div class="vidu-reference-section" id="vidu-reference-section" style="display: none;">
                    <div class="vidu-section-title">
                        🎯 参考生视频模式
                    </div>
                    <div class="vidu-reference-info">
                        <p>在此模式下，插件将：</p>
                        <ul>
                            <li>自动切换到"参考生视频"标签页</li>
                            <li>点击"主体库"按钮选择参考主体</li>
                            <li>批量输入提示词生成视频</li>
                            <li>自动启用错峰模式</li>
                        </ul>
                        <div class="vidu-reference-note">
                            <strong>注意：</strong>请确保您已登录并有权访问主体库功能
                        </div>
                    </div>
                </div>
                
                <!-- 提示词区域 -->
                <div class="vidu-prompt-section">
                    <div class="vidu-section-title">
                        ✏️ 提示词
                    </div>
                    <div class="vidu-prompt-controls">
                        <button class="vidu-btn vidu-btn-secondary" id="vidu-paste-prompts">📋 粘贴提示词</button>
                        <button class="vidu-btn vidu-btn-secondary" id="vidu-clear-prompts">🗑️ 清空</button>
                    </div>
                    <textarea 
                        class="vidu-prompt-textarea" 
                        id="vidu-prompt-textarea"
                        placeholder="请粘贴提示词，每行一个提示词&#10;例如：&#10;女孩开心地笑了&#10;男孩在公园里跑步&#10;夕阳下的海滩风景&#10;&#10;注意：参考生视频模式下，每个提示词将生成一个视频"
                    ></textarea>
                    <div class="vidu-prompt-hint">
                        <span id="vidu-prompt-count">0</span> 个提示词 | 
                        <span id="vidu-image-count" style="display: none;">0</span> 张图片 | 
                        将处理 <span id="vidu-task-count">0</span> 个任务
                    </div>
                </div>
                
                <!-- 设置区域 -->
                <div class="vidu-settings-section">
                    <div class="vidu-section-title">⚙️ 批量设置</div>
                    <div class="vidu-setting-item">
                        <span class="vidu-setting-label">处理模式:</span>
                        <select class="vidu-mode-select" id="vidu-process-mode">
                            <option value="queue">排队模式</option>
                            <option value="smart">智能检测模式</option>
                        </select>
                    </div>
                    <div id="vidu-queue-settings" class="vidu-mode-settings">
                        <div class="vidu-setting-item">
                            <span class="vidu-setting-label">每批处理数量</span>
                            <input type="number" class="vidu-setting-input" id="vidu-batch-size" value="4" min="1" max="10">
                        </div>
                        <div class="vidu-setting-item">
                            <span class="vidu-setting-label">等待时间(分钟)</span>
                            <input type="number" class="vidu-setting-input" id="vidu-wait-time" value="2" min="1" max="10">
                        </div>
                    </div>
                    <div id="vidu-smart-settings" class="vidu-mode-settings" style="display: none;">
                        <div class="vidu-setting-item">
                            <span class="vidu-setting-label">检测间隔(秒)</span>
                            <input type="number" class="vidu-setting-input" id="vidu-check-interval" value="8" min="3" max="30">
                        </div>
                        <div class="vidu-setting-item">
                            <span class="vidu-setting-label">最大重试次数</span>
                            <input type="number" class="vidu-setting-input" id="vidu-max-retries" value="5" min="1" max="20">
                        </div>
                    </div>
                </div>
                
                <!-- 视频生成设置 -->
                <div class="vidu-video-settings-section">
                    <div class="vidu-section-title">🎬 视频生成设置</div>
                    <div class="vidu-setting-item">
                        <span class="vidu-setting-label">宽高比:</span>
                        <select class="vidu-mode-select" id="vidu-aspect-ratio">
                            <option value="9:16">9:16 (竖屏)</option>
                            <option value="16:9">16:9 (横屏)</option>
                            <option value="1:1">1:1 (正方形)</option>
                            <option value="4:3">4:3 (传统)</option>
                            <option value="3:4">3:4 (竖屏传统)</option>
                        </select>
                    </div>
                    <div class="vidu-setting-item">
                        <span class="vidu-setting-label">错峰模式:</span>
                        <label class="vidu-toggle-switch">
                            <input type="checkbox" id="vidu-off-peak-mode" checked>
                            <span class="vidu-toggle-slider"></span>
                        </label>
                        <span class="vidu-toggle-label">启用错峰模式避免系统负载过高</span>
                    </div>
                    <div class="vidu-setting-item">
                        <span class="vidu-setting-label">生成数量:</span>
                        <select class="vidu-mode-select" id="vidu-generation-count">
                            <option value="1">1个</option>
                            <option value="2">2个</option>
                            <option value="3">3个</option>
                            <option value="4">4个</option>
                        </select>
                    </div>
                </div>
                
                <!-- 状态区域 -->
                <div class="vidu-status-section">
                    <div class="vidu-status" id="vidu-status">准备就绪</div>
                    <div class="vidu-progress">
                        <div class="vidu-progress-bar" id="vidu-progress-bar"></div>
                    </div>
                    <div class="vidu-log" id="vidu-log"></div>
                </div>
                
                <!-- 按钮区域 -->
                <div class="vidu-actions">
                    <button class="vidu-btn vidu-btn-primary" id="vidu-start-btn" disabled>
                        🚀 开始处理
                    </button>
                    <button class="vidu-btn vidu-btn-danger" id="vidu-stop-btn" disabled>
                        ⏹️ 停止
                    </button>
                    <button class="vidu-btn vidu-btn-secondary" id="vidu-clear-btn">
                        🗑️ 清空
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.floatingPanel);
    }
    
    bindEvents() {
        // 悬浮球点击事件
        this.floatingBall.addEventListener('click', () => {
            this.togglePanel();
        });
        
        // 模式切换事件
        const modeImg2Video = document.getElementById('vidu-mode-img2video');
        const modeReference = document.getElementById('vidu-mode-reference');
        
        if (modeImg2Video) {
            modeImg2Video.addEventListener('change', () => {
                if (modeImg2Video.checked) {
                    this.currentMode = 'img2video';
                    this.updateUIForPageType();
                    console.log('切换到图生视频模式');
                }
            });
        }
        
        if (modeReference) {
            modeReference.addEventListener('change', () => {
                if (modeReference.checked) {
                    this.currentMode = 'reference';
                    this.updateUIForPageType();
                    console.log('切换到参考生视频模式');
                }
            });
        }
        
        // 页面类型指示器点击事件 - 手动刷新页面类型检测
        const pageTypeEl = document.getElementById('vidu-page-type');
        if (pageTypeEl) {
            pageTypeEl.addEventListener('click', () => {
                this.pageType = this.detectPageType();
                this.updateUIForPageType();
                console.log('手动刷新页面类型检测:', this.pageType);
            });
        }
        
        // 关闭面板
        this.floatingPanel.querySelector('.vidu-panel-close').addEventListener('click', () => {
            this.hidePanel();
        });
        
        // 文件上传事件
        const fileInput = document.getElementById('vidu-file-input');
        const uploadArea = document.getElementById('vidu-upload-area');
        const selectFolderBtn = document.getElementById('vidu-select-folder');
        const selectFilesBtn = document.getElementById('vidu-select-files');
        
        // 文件夹选择
        selectFolderBtn.addEventListener('click', async () => {
            try {
                if ('showDirectoryPicker' in window) {
                    const directoryHandle = await window.showDirectoryPicker();
                    await this.handleDirectorySelect(directoryHandle);
                } else {
                    this.logMessage('浏览器不支持文件夹选择，请使用文件选择', 'warning');
                    try { fileInput.setAttribute('webkitdirectory', ''); fileInput.setAttribute('directory', ''); } catch (_) {}
                    fileInput.webkitdirectory = true;
                    fileInput.multiple = true;
                    fileInput.click();
                }
            } catch (error) {
                if (error && error.name === 'AbortError') return;
                try { fileInput.setAttribute('webkitdirectory', ''); fileInput.setAttribute('directory', ''); fileInput.webkitdirectory = true; fileInput.multiple = true; fileInput.click(); } catch (_) {}
                this.logMessage('文件夹选择失败: ' + (error && error.message ? error.message : String(error)), 'error');
            }
        });
        
        // 文件选择
        selectFilesBtn.addEventListener('click', () => {
            try { fileInput.removeAttribute('webkitdirectory'); fileInput.removeAttribute('directory'); } catch (_) {}
            fileInput.webkitdirectory = false;
            fileInput.multiple = true;
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });
        
        // 拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFileSelect(e.dataTransfer.files);
        });
        
        // 提示词输入事件
        const promptTextarea = document.getElementById('vidu-prompt-textarea');
        const pastePromptsBtn = document.getElementById('vidu-paste-prompts');
        const clearPromptsBtn = document.getElementById('vidu-clear-prompts');
        
        promptTextarea.addEventListener('input', () => {
            this.updatePrompts();
            this.checkReadyState();
        });
        
        // 粘贴提示词
        pastePromptsBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text.trim()) {
                    promptTextarea.value = text.trim();
                    this.updatePrompts();
                    this.checkReadyState();
                    this.logMessage(`已粘贴 ${this.prompts.length} 个提示词`, 'success');
                } else {
                    this.logMessage('剪贴板为空', 'warning');
                }
            } catch (error) {
                this.logMessage('粘贴失败，请手动粘贴: ' + error.message, 'error');
                // 降级方案：聚焦到文本框让用户手动粘贴
                promptTextarea.focus();
            }
        });
        
        // 清空提示词
        clearPromptsBtn.addEventListener('click', () => {
            promptTextarea.value = '';
            this.updatePrompts();
            this.checkReadyState();
            this.logMessage('已清空提示词', 'info');
        });
        
        // 设置变更事件
        ['vidu-process-mode', 'vidu-batch-size', 'vidu-wait-time', 'vidu-check-interval', 'vidu-max-retries', 'vidu-aspect-ratio', 'vidu-generation-count'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.updateSettings();
            });
        });
        
        // 错峰模式切换事件
        document.getElementById('vidu-off-peak-mode').addEventListener('change', () => {
            this.updateSettings();
        });
        
        // 处理模式切换事件
        document.getElementById('vidu-process-mode').addEventListener('change', () => {
            this.toggleProcessMode();
        });
        
        // 按钮事件
        document.getElementById('vidu-start-btn').addEventListener('click', () => {
            this.startProcessing();
        });
        
        document.getElementById('vidu-stop-btn').addEventListener('click', () => {
            this.stopProcessing();
        });
        
        document.getElementById('vidu-clear-btn').addEventListener('click', () => {
            this.clearAll();
        });
        
        // 参考生视频按钮事件
        document.getElementById('vidu-reference-btn').addEventListener('click', () => {
            this.switchToReferenceMode();
        });
        
        // 点击面板外部关闭
        document.addEventListener('click', (e) => {
            if (!this.floatingPanel.contains(e.target) && !this.floatingBall.contains(e.target)) {
                this.hidePanel();
            }
        });
    }
    
    togglePanel() {
        if (this.isVisible) {
            this.hidePanel();
        } else {
            this.showPanel();
        }
    }
    
    showPanel() {
        this.floatingPanel.classList.add('show');
        this.isVisible = true;
    }
    
    hidePanel() {
        this.floatingPanel.classList.remove('show');
        this.isVisible = false;
    }
    
    async handleDirectorySelect(directoryHandle) {
        try {
            const imageFiles = [];
            const walk = async (dir) => {
                for await (const entry of dir.values()) {
                    if (entry.kind === 'file') {
                        const file = await entry.getFile();
                        if (file && file.type && file.type.startsWith('image/') && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                            imageFiles.push(file);
                        }
                    } else if (entry.kind === 'directory') {
                        await walk(entry);
                    }
                }
            };
            await walk(directoryHandle);
            
            if (imageFiles.length === 0) {
                this.logMessage('文件夹中未找到有效的图片文件', 'warning');
                return;
            }
            
            this.selectedImages.push(...imageFiles);
            this.sortImages();
            this.updateImagePreview();
            this.checkReadyState();
            this.logMessage(`从文件夹中添加了 ${imageFiles.length} 张图片`, 'success');
            
        } catch (error) {
            this.logMessage('读取文件夹失败: ' + (error && error.message ? error.message : String(error)), 'error');
        }
    }
    
    handleFileSelect(files) {
        const validFiles = Array.from(files).filter(file => {
            return file.type.startsWith('image/') && 
                   ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
        });
        
        if (validFiles.length === 0) {
            this.logMessage('请选择有效的图片文件 (JPG, PNG, WebP)', 'error');
            return;
        }
        
        // 添加到已选择的图片列表
        this.selectedImages.push(...validFiles);
        
        // 按文件名排序
        this.sortImages();
        
        // 更新预览
        this.updateImagePreview();
        
        // 检查就绪状态
        this.checkReadyState();
        
        this.logMessage(`已添加 ${validFiles.length} 张图片`, 'success');
    }
    
    sortImages() {
        this.selectedImages.sort((a, b) => {
            const getNumber = (filename) => {
                const match = filename.match(/(\d+)|shot_(\d+)/i);
                if (match) {
                    return parseInt(match[1] || match[2]);
                }
                return 0;
            };
            
            return getNumber(a.name) - getNumber(b.name);
        });
    }
    
    updateImagePreview() {
        const preview = document.getElementById('vidu-image-preview');
        preview.innerHTML = '';
        
        this.selectedImages.forEach((file, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'vidu-image-item';
            
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = file.name;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'vidu-image-remove';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => this.removeImage(index);
            
            imageItem.appendChild(img);
            imageItem.appendChild(removeBtn);
            preview.appendChild(imageItem);
        });
        
        // 更新计数
        this.updateCounts();
    }
    
    removeImage(index) {
        this.selectedImages.splice(index, 1);
        this.updateImagePreview();
        this.checkReadyState();
        this.logMessage('已移除图片', 'info');
    }
    
    updatePrompts() {
        const textarea = document.getElementById('vidu-prompt-textarea');
        this.prompts = textarea.value
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        this.updateCounts();
    }
    
    updateCounts() {
        const promptCount = this.prompts.length;
        const imageCount = this.selectedImages.length;
        
        if (this.pageType === 'reference') {
            // 参考生视频模式：任务数等于提示词数
            const taskCount = promptCount;
            document.getElementById('vidu-prompt-count').textContent = promptCount;
            document.getElementById('vidu-task-count').textContent = taskCount;
        } else {
            // 图生视频模式：任务数等于图片数和提示词数的最小值
            const taskCount = Math.min(promptCount, imageCount);
            document.getElementById('vidu-prompt-count').textContent = promptCount;
            document.getElementById('vidu-image-count').textContent = imageCount;
            document.getElementById('vidu-task-count').textContent = taskCount;
        }
    }
    
    checkReadyState() {
        const hasImages = this.selectedImages.length > 0;
        const hasPrompts = this.prompts.length > 0;
        let isReady = false;
        
        if (this.pageType === 'reference') {
            // 参考生视频模式：只需要提示词
            isReady = hasPrompts && !this.isProcessing;
        } else {
            // 图生视频模式：需要图片和提示词
            isReady = hasImages && hasPrompts && !this.isProcessing;
        }
        
        const startBtn = document.getElementById('vidu-start-btn');
        if (startBtn) {
            startBtn.disabled = !isReady;
        }
        
        if (this.pageType === 'reference') {
            if (hasPrompts) {
                this.updateStatus(`准备就绪 - ${this.prompts.length} 个任务待处理`);
            } else {
                this.updateStatus('请输入提示词');
            }
        } else {
            if (hasImages && hasPrompts) {
                const taskCount = Math.min(this.selectedImages.length, this.prompts.length);
                this.updateStatus(`准备就绪 - ${taskCount} 个任务待处理`);
            } else if (!hasImages && !hasPrompts) {
                this.updateStatus('请选择图片并输入提示词');
            } else if (!hasImages) {
                this.updateStatus('请选择图片文件');
            } else {
                this.updateStatus('请输入提示词');
            }
        }
    }
    
    async startProcessing() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this._completed = false;
        this.floatingBall.classList.add('processing');
        document.getElementById('vidu-start-btn').disabled = true;
        document.getElementById('vidu-stop-btn').disabled = false;
        
        let taskCount;
        if (this.pageType === 'reference') {
            // 参考生视频模式：只需要提示词
            taskCount = this.prompts.length;
        } else {
            // 图生视频模式：需要图片和提示词
            taskCount = Math.min(this.selectedImages.length, this.prompts.length);
        }
        
        this.currentTaskIndex = 0;
        
        this.logMessage('开始批量处理...', 'info');
        this.updateStatus('正在处理中...');
        
        try {
            for (let i = 0; i < taskCount; i++) {
                if (!this.isProcessing) break;
                
                this.currentTaskIndex = i;
                const progress = ((i + 1) / taskCount) * 100;
                this.updateProgress(progress);
                
                let imageFile = null;
                const prompt = this.prompts[i] || '';
                
                if (this.pageType === 'reference') {
                    // 参考生视频模式：不需要图片
                    this.logMessage(`处理任务 ${i + 1}/${taskCount}: ${prompt.substring(0, 30)}...`, 'info');
                } else {
                    // 图生视频模式：需要图片
                    imageFile = this.selectedImages[i];
                    if (!imageFile) {
                        this.logMessage(`任务 ${i + 1}/${taskCount}: 缺少图片，跳过`, 'warning');
                        continue;
                    }
                    this.logMessage(`处理任务 ${i + 1}/${taskCount}: ${imageFile.name}`, 'info');
                }
                
                await this.processSingleTask(imageFile, prompt);
                
                // 检查是否需要等待（排队模式）
                if (this.settings.processMode === 'queue' && 
                    (i + 1) % this.settings.batchSize === 0 && 
                    i < taskCount - 1) {
                    
                    const waitTime = this.settings.waitTime * 60 * 1000;
                    this.logMessage(`已处理 ${i + 1} 个任务，等待 ${this.settings.waitTime} 分钟...`, 'warning');
                    await this.sleep(waitTime);
                }
                
                // 任务间隔
                await this.sleep(2000);
            }
            
            this.logMessage('批量处理完成!', 'success');
            this.updateStatus('处理完成');
            this._completed = true;
            
        } catch (error) {
            this.logMessage(`处理出错: ${error.message}`, 'error');
            this.updateStatus('处理失败');
        } finally {
            this.stopProcessing(this._completed === true);
        }
    }
    
    async processSingleTask(imageFile, prompt) {
        try {
            this.setWorking(true);
            
            if (this.pageType === 'reference') {
                // 参考生视频模式：先应用设置，再处理任务
                await this.applyVideoSettings();
                await this.processReferenceTask(prompt);
            } else {
                // 图生视频模式
                await this.processImg2VideoTask(imageFile, prompt);
            }
            
            this.setWorking(false);
            
        } catch (error) {
            this.logMessage(`任务失败: ${error.message}`, 'error');
            this.setWorking(false);
            throw error;
        }
    }
    
    async processImg2VideoTask(imageFile, prompt) {
        // 1. 上传图片
        await this.uploadImage(imageFile);
        await this.sleep(1000);
        
        // 2. 输入提示词
        await this.inputPrompt(prompt);
        await this.sleep(1000);
        
        // 3. 使用智能检测点击创作按钮，避免网络卡顿导致误提交
        const queueBefore = this.countInProgressQueue();
        await this.clickCreateButtonWithSmartDetection(imageFile);
        await this.waitForSubmissionStart(imageFile, queueBefore);
        
        this.logMessage(`任务完成: ${imageFile.name}`, 'success');
        
        // 4. 点击清空按钮，为下一个任务准备
        await this.clickClearButton();
        await this.waitForPageReset();
    }
    
    async processReferenceTask(prompt) {
        try {
            this.logMessage(`开始处理参考生视频任务: ${prompt.substring(0, 30)}...`, 'info');
            
            // 1. 在左侧主页面输入提示词
            this.logMessage('步骤1: 输入提示词到文本框', 'info');
            await this.inputPromptToMainPage(prompt);
            await this.sleep(1000);
            
            // 2. 点击主体库按钮
            this.logMessage('步骤2: 点击主体库按钮', 'info');
            await this.clickSubjectLibraryButton();
            await this.sleep(2000);
            
            // 3. 分析提示词中的人名，在主体库中选择匹配的主体
            this.logMessage('步骤3: 分析提示词并选择匹配的主体', 'info');
            await this.selectMatchingSubjects(prompt);
            await this.sleep(1000);
            
            // 4. 点击确定按钮
            this.logMessage('步骤4: 点击确定按钮', 'info');
            await this.clickConfirmButton();
            await this.sleep(1000);
            
            // 5. 选择宽高比
            this.logMessage('步骤5: 选择宽高比', 'info');
            await this.setAspectRatio(this.settings.aspectRatio);
            await this.sleep(500);
            
            // 6. 选择错峰模式
            this.logMessage('步骤6: 选择错峰模式', 'info');
            if (this.settings.offPeakMode) {
                await this.enableOffPeakMode();
            }
            await this.sleep(500);
            
            // 7. 点击创作按钮
            this.logMessage('步骤7: 点击创作按钮', 'info');
            await this.clickMainCreateButton();
            
            // 8. 等待提交完成
            await this.waitForMainPageSubmission();
            
            this.logMessage(`任务完成: ${prompt.substring(0, 30)}...`, 'success');
            
            // 9. 清空内容，为下一个任务准备
            await this.clearMainPageContent();
            await this.waitForPageReset();
            
        } catch (error) {
            this.logMessage(`处理参考生视频任务失败: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async uploadImage(imageFile) {
        if (!imageFile) {
            throw new Error('图片文件不存在');
        }
        
        const fileInput = await this.waitForUploadReady(30000);
        const zone = this.findFirstFrameZone();
        let applied = false;
        
        try {
            const dt = new DataTransfer();
            dt.items.add(imageFile);
            try { fileInput.files = dt.files; } catch (_) {}
            try { fileInput.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
            try { fileInput.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
        } catch (_) {}
        
        // 等待文件上传生效
        for (let i = 0, streak = 0; i < 16; i++) {
            let ok = false;
            try {
                if (fileInput && fileInput.files && fileInput.files.length > 0) {
                    const nameNow = fileInput.files[0] && fileInput.files[0].name;
                    if (!imageFile || nameNow === imageFile.name) ok = true;
                }
            } catch (_) {}
            if (!ok) ok = !this.isFirstFrameZoneEmpty();
            streak = ok ? (streak + 1) : 0;
            if (streak >= 2) { applied = true; break; }
            await this.sleep(300);
        }
        
        // 如果文件输入没生效，尝试拖拽上传
        if (!applied && zone) {
            try {
                const dt2 = new DataTransfer();
                dt2.items.add(imageFile);
                const fire = (target, type) => {
                    try {
                        const e = new DragEvent(type, { bubbles: true, cancelable: true });
                        try { Object.defineProperty(e, 'dataTransfer', { value: dt2 }); } catch (_) {}
                        target.dispatchEvent(e);
                    } catch (_) {}
                };
                try { zone.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
                fire(zone, 'dragenter');
                fire(zone, 'dragover');
                fire(zone, 'drop');
            } catch (_) {}

            for (let i = 0, streak = 0; i < 16; i++) {
                let ok = false;
                try {
                    if (fileInput && fileInput.files && fileInput.files.length > 0) {
                        const nameNow = fileInput.files[0] && fileInput.files[0].name;
                        if (!imageFile || nameNow === imageFile.name) ok = true;
                    }
                } catch (_) {}
                if (!ok) ok = !this.isFirstFrameZoneEmpty();
                streak = ok ? (streak + 1) : 0;
                if (streak >= 2) { applied = true; break; }
                await this.sleep(300);
            }
            // 额外尝试：在首帧区域内各子元素上模拟drop
            if (!applied) {
                try {
                    const dt3 = new DataTransfer();
                    dt3.items.add(imageFile);
                    const children = this.deepQuerySelectorAll(['div','label','button','svg'], zone);
                    for (const c of children) {
                        const evt = new DragEvent('drop', { bubbles: true, cancelable: true });
                        try { Object.defineProperty(evt, 'dataTransfer', { value: dt3 }); } catch (_) {}
                        try { c.dispatchEvent(evt); } catch (_) {}
                        await this.sleep(100);
                        const nowEmpty = this.isFirstFrameZoneEmpty();
                        if (!nowEmpty) { applied = true; break; }
                    }
                } catch (_) {}
            }
        }
        
        if (!applied) throw new Error('图片上传失败');
        await this.sleep(800);
        this.logMessage(`图片上传完成: ${imageFile.name}`, 'success');
    }
    
    async inputPrompt(promptText) {
        const el = await this.waitForPromptInput(15000);
        if (!el) {
            throw new Error('未找到提示词输入框');
        }
        const safeText = (typeof promptText === 'string' && promptText.length > 0) ? promptText : ' ';
        this.lastPrompt = safeText;
        if (el.tagName && (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input')) {
            el.value = '';
            el.focus();
            el.value = safeText;
        } else {
            el.focus();
            el.textContent = '';
            el.textContent = safeText;
        }
        const inputEvent = new Event('input', { bubbles: true });
        el.dispatchEvent(inputEvent);
        const changeEvent = new Event('change', { bubbles: true });
        el.dispatchEvent(changeEvent);
        await this.sleep(500);
        this.logMessage(`提示词输入完成: ${safeText.substring(0, 30)}...`, 'success');
    }

    queryPromptInputElement() {
        const selectors = [
            'textarea[maxlength="1500"]',
            'textarea[placeholder]',
            'textarea',
            '[contenteditable="true"]',
            '[role="textbox"]'
        ];
        const nodes = this.deepQuerySelectorAll(selectors).filter(n => !this.isInsideOurUI(n));
        return nodes[0] || null;
    }

    async waitForPromptInput(timeoutMs = 15000) {
        const start = Date.now();
        let el = this.queryPromptInputElement();
        while (!el && Date.now() - start < timeoutMs) {
            await this.sleep(500);
            el = this.queryPromptInputElement();
        }
        return el;
    }
    
    
    findCreateButton() {
        const selectors = [
            'button',
            '[role="button"]',
            'a',
            'div[role="button"]',
            'div[class*="Button"]',
            'div[class*="create"]',
            'div[class*="submit"]'
        ];
        const nodes = this.deepQuerySelectorAll(selectors);
        for (const node of nodes) {
            const text = (node.textContent || node.innerText || '').trim();
            const aria = (node.getAttribute && (node.getAttribute('aria-label') || node.getAttribute('title'))) || '';
            const low = text.toLowerCase();
            const alow = aria.toLowerCase();
            if (
                text.includes('创作') || aria.includes('创作') ||
                text.includes('开始创作') || aria.includes('开始创作') ||
                low.includes('create') || alow.includes('create') ||
                text.includes('生成') || aria.includes('生成') ||
                low.includes('generate') || alow.includes('generate')
            ) {
                return node;
            }
        }
        return null;
    }

    isButtonClickable(button) {
        if (!button) return false;
        if ('disabled' in button && button.disabled) return false;
        const ariaDisabled = button.getAttribute && button.getAttribute('aria-disabled');
        if (ariaDisabled === 'true') return false;
        const style = window.getComputedStyle(button);
        if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
        const rect = button.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const text = (button.textContent || button.innerText || '').trim();
        const aria = (button.getAttribute && (button.getAttribute('aria-label') || button.getAttribute('title'))) || '';
        const low = text.toLowerCase();
        const alow = aria.toLowerCase();
        const okLabel = (
            text.includes('创作') || aria.includes('创作') ||
            text.includes('开始创作') || aria.includes('开始创作') ||
            text.includes('生成') || aria.includes('生成') ||
            low.includes('create') || alow.includes('create') ||
            low.includes('generate') || alow.includes('generate') ||
            low.includes('submit') || alow.includes('submit')
        );
        if (!okLabel) return false;
        return true;
    }

    isCreateButtonBusy() {
        const btn = this.findCreateButton();
        if (!btn) return false;
        const disabledProp = ('disabled' in btn) && btn.disabled;
        const ariaDisabled = btn.getAttribute && btn.getAttribute('aria-disabled') === 'true';
        let pointerNone = false;
        try { const s = window.getComputedStyle(btn); pointerNone = (s.pointerEvents === 'none' || s.cursor === 'not-allowed'); } catch (_) {}
        const text = ((btn.textContent || btn.innerText || '') + ' ' + (btn.getAttribute ? ((btn.getAttribute('aria-label') || btn.getAttribute('title')) || '') : '')).toLowerCase();
        const busyText = text.includes('排队') || text.includes('生成中') || text.includes('进行中') || text.includes('处理中') || text.includes('已提交') || text.includes('已加入');
        const loadingEl = btn.querySelector && btn.querySelector('[class*="loading"], [class*="spinner"], [class*="progress"]');
        return disabledProp || ariaDisabled || pointerNone || !!loadingEl || busyText;
    }

    resolveClickableNode(node) {
        if (!node) return null;
        if (typeof node.click === 'function') return node;
        const descendants = node.querySelectorAll ? node.querySelectorAll('button, [role="button"], a') : [];
        for (const d of descendants) {
            if (typeof d.click === 'function') return d;
        }
        const ancestor = node.closest ? node.closest('button, [role="button"], a') : null;
        if (ancestor && typeof ancestor.click === 'function') return ancestor;
        return node;
    }

    attemptClick(node) {
        try {
            const rect = node.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
            node.dispatchEvent(new MouseEvent('pointerdown', opts));
            node.dispatchEvent(new MouseEvent('mousedown', opts));
            node.dispatchEvent(new MouseEvent('pointerup', opts));
            node.dispatchEvent(new MouseEvent('mouseup', opts));
        } catch (_) {}
        try { node.click(); } catch (_) {}
        try { node.focus({ preventScroll: true }); node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); node.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })); } catch (_) {}
    }

    async clickCreateButtonWithSmartDetection(expectedImageFile) {
        const maxRetries = this.settings.maxRetries || 5;
        const checkInterval = (this.settings.checkInterval || 8) * 1000;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            // 给页面一个短暂的稳定时间
            await this.sleep(2000);
            
            const createButton = this.findCreateButton();
            const promptEl = this.queryPromptInputElement();
            const promptValue = promptEl ? (promptEl.tagName ? promptEl.value : (promptEl.textContent || '')) : '';
            const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
            const promptOk = promptEl ? (norm(promptValue) === norm(this.lastPrompt)) : true;
            let imageOk = false;
            const fileInput = this.chooseFirstFrameFileInput();
            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                imageOk = !expectedImageFile || fileInput.files[0].name === expectedImageFile.name;
            }
            if (!imageOk) {
                const previews = this.deepQuerySelectorAll([
                    'img[src^="blob:"]',
                    'img[src^="data:"]',
                    '[class*="preview"] img',
                    '[class*="thumb"] img'
                ]);
                imageOk = previews.length > 0;
            }
            const relax = attempt >= Math.ceil(maxRetries / 2);
            
            if (createButton && this.isButtonClickable(createButton) && promptOk && (imageOk || relax)) {
                try {
                    createButton.scrollIntoView({ block: 'center', inline: 'center' });
                } catch (_) {}
                try {
                    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
                    const up = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
                    createButton.dispatchEvent(down);
                    createButton.dispatchEvent(up);
                } catch (_) {}
                try { createButton.click(); } catch (_) {}
                this.logMessage(`智能检测成功 - 第 ${attempt} 次点击创作`, 'info');
                return;
            }
            
            if (attempt < maxRetries) {
                this.logMessage(`创作未就绪(第 ${attempt}/${maxRetries})，promptOk=${promptOk}, imageOk=${imageOk}，等待 ${this.settings.checkInterval} 秒后重试...`, 'warning');
                await this.sleep(checkInterval);
            }
        }
        
        throw new Error(`智能检测失败 - 重试 ${maxRetries} 次后仍不可点击`);
    }

    deepQuerySelectorAll(selectors, root = document) {
        const results = [];
        const searchInRoot = (r) => {
            for (const sel of selectors) {
                try {
                    const nodeList = r.querySelectorAll(sel);
                    nodeList.forEach(n => results.push(n));
                } catch (_) {}
            }
            const walker = document.createTreeWalker(r, NodeFilter.SHOW_ELEMENT, null);
            let current = walker.currentNode;
            while (current) {
                const el = current;
                if (el.shadowRoot) {
                    searchInRoot(el.shadowRoot);
                }
                if (el.tagName && el.tagName.toLowerCase() === 'iframe') {
                    try {
                        const doc = el.contentDocument;
                        if (doc) searchInRoot(doc);
                    } catch (_) {}
                }
                current = walker.nextNode();
            }
        };
        searchInRoot(root);
        return results;
    }

    isElementVisible(el) {
        try {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style && style.visibility !== 'hidden' && style.display !== 'none' && style.pointerEvents !== 'none' && rect.width > 0 && rect.height > 0;
        } catch (_) {
            return false;
        }
    }

    isInsideOurUI(el) {
        try {
            if (!el) return false;
            if (!el.closest) return false;
            const inUI = !!(
                el.closest('.vidu-floating-panel') ||
                el.closest('.vidu-floating-ball') ||
                el.closest('#floating-button') ||
                el.closest('[id^="vidu-"]') ||
                el.closest('[class*="vidu-"]')
            );
            return inUI;
        } catch (_) { return false; }
    }

    chooseFirstFrameFileInput() {
        const zone = this.findFirstFrameZone();
        // 1) 区域内查找
        if (zone) {
            let searchRoot = zone;
            for (let depth = 0; depth < 6 && searchRoot; depth++) {
                const zoned = this.deepQuerySelectorAll([
                    'input[type="file"][accept*="image"]',
                    'input[type="file"]'
                ], searchRoot).filter(el => !this.isInsideOurUI(el));
                if (zoned.length > 0) return zoned[0];
                searchRoot = searchRoot.parentElement || searchRoot.parentNode;
            }
        }
        // 2) 全局最近原则
        const inputs = this.deepQuerySelectorAll([
            'input[type="file"][accept*="image"]',
            'input[type="file"]'
        ]).filter(el => !this.isInsideOurUI(el));
        if (inputs.length === 0) return null;
        if (zone) {
            try {
                const zr = zone.getBoundingClientRect();
                const zx = zr.left + zr.width / 2;
                const zy = zr.top + zr.height / 2;
                inputs.sort((a, b) => {
                    const ra = a.getBoundingClientRect();
                    const rb = b.getBoundingClientRect();
                    const da = Math.abs((ra.left + ra.width / 2) - zx) + Math.abs((ra.top + ra.height / 2) - zy);
                    const db = Math.abs((rb.left + rb.width / 2) - zx) + Math.abs((rb.top + rb.height / 2) - zy);
                    return da - db;
                });
            } catch (_) {}
        } else {
            inputs.sort((a, b) => {
                const ra = a.getBoundingClientRect();
                const rb = b.getBoundingClientRect();
                if (ra.left !== rb.left) return ra.left - rb.left;
                return ra.top - rb.top;
            });
        }
        return inputs[0] || null;
    }

    async waitForUploadReady(timeoutMs = 30000) {
        const start = Date.now();
        let input = this.chooseFirstFrameFileInput();
        let lastClick = 0;
        while (!input && Date.now() - start < timeoutMs) {
            const zone = this.findFirstFrameZone();
            if (zone && Date.now() - lastClick > 500) {
                try { zone.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
                try { this.attemptClick ? this.attemptClick(zone) : zone.click(); } catch (_) {}
                lastClick = Date.now();
            }
            await this.sleep(500);
            input = this.chooseFirstFrameFileInput();
        }
        if (!input) throw new Error('未找到图片上传输入框');
        return input;
    }

    findFirstFrameZone() {
        // 0) 基于隐藏 file input 的上层容器（优先）
        try {
            const inputCandidates = this.deepQuerySelectorAll([
                'div.inline-flex input[type="file"][accept*="image"]',
                'input[type="file"][accept*="image"][multiple]'
            ]).filter(n => !this.isInsideOurUI(n));
            const containers = [];
            for (const inp of inputCandidates) {
                let c = null;
                try { c = inp.closest('.inline-flex.cursor-pointer'); } catch (_) {}
                if (!c) try { c = inp.closest('.rounded-10'); } catch (_) {}
                if (!c) c = inp.parentElement || inp.parentNode;
                if (c && !this.isInsideOurUI(c) && this.isElementVisible(c)) containers.push(c);
            }
            // 仅接受大尺寸候选，过滤右上小图标
            const valids = containers.filter(c => {
                try {
                    const r = c.getBoundingClientRect();
                    return r.width >= 300 && r.height >= 120 && r.top > 80;
                } catch (_) { return false; }
            });
            if (valids.length > 0) {
                valids.sort((a, b) => {
                    const ra = a.getBoundingClientRect();
                    const rb = b.getBoundingClientRect();
                    if (ra.left !== rb.left) return ra.left - rb.left;
                    return ra.top - rb.top;
                });
                return valids[0];
            }
        } catch (_) {}

        // 1) 文本/结构启发式（回退），并按大尺寸过滤
        const pool = this.deepQuerySelectorAll([
            'div', 'section', 'article'
        ]).filter(el => this.isElementVisible(el) && !this.isInsideOurUI(el));
        const textOf = (el) => ((el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim());
        const candidates = pool.filter(n => {
            try {
                const r = n.getBoundingClientRect();
                return (r.width >= 300 && r.height >= 120 && r.top > 80) && /首帧|上传|选择|add|upload|image|图片/i.test(textOf(n));
            } catch (_) { return false; }
        });
        if (candidates.length === 0) return null;
        candidates.sort((a, b) => {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            if (ra.left !== rb.left) return ra.left - rb.left;
            return ra.top - rb.top;
        });
        return candidates[0] || null;
    }

    isFirstFrameZoneEmpty() {
        const zone = this.findFirstFrameZone();
        if (!zone) return false;
        // 排除插件自身UI和过小区域，避免误判为空
        try {
            const zr = zone.getBoundingClientRect();
            if (this.isInsideOurUI(zone) || zr.width < 200 || zr.height < 100 || zr.top < 60) {
                console.log('[VIDU-DBG] isFirstFrameZoneEmpty:reject-zone', { inUI: this.isInsideOurUI(zone), zr });
                return false;
            }
        } catch (_) {}
        
        console.log('[VIDU-DBG] isFirstFrameZoneEmpty:check', 'zone:', zone);
        
        // 1. 检查所有图片元素
        const imgs = this.deepQuerySelectorAll([
            'img[src^="blob:"]',
            'img[src^="data:"]',
            'img[src^="http"]',
            'img[src^="/"]',
            'img',
            '[class*="preview"] img',
            '[class*="thumb"] img',
            '[class*="image"] img'
        ], zone);
        
        // 过滤掉明显的装饰性图片（如图标）
        const realImages = imgs.filter(img => {
            try {
                const rect = img.getBoundingClientRect();
                const src = img.src || '';
                // 排除小图标和装饰图片
                if (rect.width < 50 || rect.height < 50) return false;
                if (src.includes('icon') || src.includes('logo')) return false;
                return true;
            } catch (_) {
                return true; // 保守处理，如果无法判断则认为是真实图片
            }
        });
        
        console.log('[VIDU-DBG] isFirstFrameZoneEmpty:images', 'total:', imgs.length, 'real:', realImages.length);
        if (realImages.length > 0) {
            console.log('[VIDU-DBG] isFirstFrameZoneEmpty:result', false, 'reason: has images');
            return false;
        }
        
        // 2. 检查背景图片
        const allElements = zone.querySelectorAll('*');
        for (const el of allElements) {
            try {
                const style = window.getComputedStyle(el);
                const bgImage = style.backgroundImage;
                if (bgImage && bgImage !== 'none' && !bgImage.includes('gradient')) {
                    console.log('[VIDU-DBG] isFirstFrameZoneEmpty:result', false, 'reason: has background image');
                    return false;
                }
            } catch (_) {}
        }
        
        // 3. 检查 file input
        const inputs = this.deepQuerySelectorAll([
            'input[type="file"][accept*="image"]',
            'input[type="file"]'
        ], zone);
        
        for (const input of inputs) {
            if (input.files && input.files.length > 0) {
                console.log('[VIDU-DBG] isFirstFrameZoneEmpty:result', false, 'reason: input has files');
                return false;
            }
        }
        
        // 4. 检查是否有显示上传内容的容器
        const contentElements = zone.querySelectorAll('[class*="content"], [class*="upload"], [class*="preview"], [class*="thumb"]');
        for (const el of contentElements) {
            try {
                const rect = el.getBoundingClientRect();
                const text = el.textContent || '';
                // 如果容器有内容且不是空状态提示
                if (rect.width > 100 && rect.height > 50 && text.trim() && !text.includes('上传') && !text.includes('选择') && !text.includes('+')) {
                    console.log('[VIDU-DBG] isFirstFrameZoneEmpty:result', false, 'reason: has content');
                    return false;
                }
            } catch (_) {}
        }
        
        console.log('[VIDU-DBG] isFirstFrameZoneEmpty:result', true, 'reason: all checks passed');
        return true;
    }

    async waitForSubmissionStart(expectedImageFile, queueBefore = null) {
        const pollMs = 1000;
        const maxLoops = Math.max(12, (this.settings?.maxRetries || 5) * 3);
        const minWaitMs = Math.max(2500, Number(this.settings?.postClickMinWaitMs) || 4000);
        const t0 = Date.now();
        // 移除网络拦截（CSP限制）
        let busyStreak = 0;
        let inputChangedStreak = 0;
        let zoneEmptyStreak = 0;
        let seenDisabledOnce = false;
        for (let i = 0; i < maxLoops; i++) {
            let inputChanged = false;
            try {
                const fileInput = this.chooseFirstFrameFileInput();
                if (fileInput && fileInput.files) {
                    if (!expectedImageFile) {
                        inputChanged = fileInput.files.length === 0;
                    } else {
                        const len0 = fileInput.files.length === 0;
                        const nameNow = fileInput.files[0] && fileInput.files[0].name;
                        inputChanged = len0 || (nameNow && nameNow !== expectedImageFile.name);
                    }
                }
            } catch (_) {}

            const zoneEmpty = this.isFirstFrameZoneEmpty();
            inputChangedStreak = inputChanged ? (inputChangedStreak + 1) : 0;
            zoneEmptyStreak = zoneEmpty ? (zoneEmptyStreak + 1) : 0;

            const hints = this.deepQuerySelectorAll([
                '[class*="toast"]',
                '[class*="message"]',
                '[class*="notify"]',
                '[role*="status"]',
                '[aria-live]'
            ]).filter(n => {
                const t = (n.textContent || '').toLowerCase();
                return t.includes('已提交') || t.includes('提交成功') || t.includes('进入队列') || t.includes('加入队列') || t.includes('已加入队列') || t.includes('已添加到队列') || t.includes('开始生成');
            });
            const btnEl = this.findCreateButton();
            let disabledNow = false;
            if (btnEl) {
                const ariaDisabled = btnEl.getAttribute && btnEl.getAttribute('aria-disabled') === 'true';
                disabledNow = (('disabled' in btnEl) && btnEl.disabled) || ariaDisabled;
            }
            if (disabledNow) seenDisabledOnce = true;
            const btnBusy = this.isCreateButtonBusy();
            busyStreak = btnBusy ? (busyStreak + 1) : 0;

            // 队列面板确认：进行中数量相对点击前是否增加
            let queueIncreased = false;
            try {
                if (queueBefore !== null) {
                    const nowCount = this.countInProgressQueue();
                    queueIncreased = nowCount > queueBefore;
                }
            } catch (_) {}

            const combinedOk = (((zoneEmptyStreak >= 3 || inputChangedStreak >= 3) && (busyStreak >= 3) && seenDisabledOnce) || queueIncreased);
            if ((hints.length > 0 || combinedOk) && (Date.now() - t0) >= minWaitMs) return;
            await this.sleep(pollMs);
        }
    }

    countInProgressQueue() {
        const containers = this.deepQuerySelectorAll([
            '[class*="running"]',
            '[class*="progress"]',
            '[class*="queue"]',
            '[aria-live]',
            'aside',
            'section',
            'div'
        ]).filter(el => {
            const t = (el.textContent || '').toLowerCase();
            return t.includes('进行中') || t.includes('排队') || t.includes('in progress') || t.includes('queue');
        });
        let maxCount = 0;
        for (const c of containers) {
            let cnt = 0;
            const items = c.querySelectorAll('a, li, [class*="card"], [class*="item"], [class*="work"], [class*="video"]');
            items.forEach(el => {
                try {
                    const s = window.getComputedStyle(el);
                    if (s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().height > 0) cnt++;
                } catch (_) { cnt++; }
            });
            if (cnt > maxCount) maxCount = cnt;
        }
        return maxCount;
    }
    
    stopProcessing(completed = false) {
        this.isProcessing = false;
        this.floatingBall.classList.remove('processing');
        document.getElementById('vidu-start-btn').disabled = false;
        document.getElementById('vidu-stop-btn').disabled = true;
        this.updateStatus(completed ? '处理完成' : '处理已停止');
    }

    setWorking(isWorking) {
        if (!this.floatingBall) return;
        if (isWorking) {
            this.floatingBall.classList.add('processing');
        } else {
            if (!this.isProcessing) {
                this.floatingBall.classList.remove('processing');
            }
        }
    }
    
    clearAll() {
        this.selectedImages = [];
        this.prompts = [];
        document.getElementById('vidu-prompt-textarea').value = '';
        this.updateImagePreview();
        this.checkReadyState();
        this.clearLog();
        this.updateProgress(0);
        this.logMessage('已清空所有数据', 'info');
    }
    
    updateSettings() {
        this.settings = {
            processMode: document.getElementById('vidu-process-mode').value,
            batchSize: parseInt(document.getElementById('vidu-batch-size').value),
            waitTime: parseInt(document.getElementById('vidu-wait-time').value),
            checkInterval: parseInt(document.getElementById('vidu-check-interval').value),
            maxRetries: parseInt(document.getElementById('vidu-max-retries').value),
            aspectRatio: document.getElementById('vidu-aspect-ratio').value,
            offPeakMode: document.getElementById('vidu-off-peak-mode').checked,
            generationCount: parseInt(document.getElementById('vidu-generation-count').value)
        };
        
        this.saveSettings();
    }
    
    saveSettings() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ videuSettings: this.settings });
        } else {
            // 降级到localStorage
            localStorage.setItem('videuSettings', JSON.stringify(this.settings));
        }
    }
    
    loadSettings() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['videuSettings'], (result) => {
                if (result.videuSettings) {
                    this.settings = { ...this.settings, ...result.videuSettings };
                    this.updateSettingsUI();
                }
            });
        } else {
            // 降级到localStorage
            try {
                const saved = localStorage.getItem('videuSettings');
                if (saved) {
                    this.settings = { ...this.settings, ...JSON.parse(saved) };
                    this.updateSettingsUI();
                }
            } catch (error) {
                console.log('加载设置失败:', error);
            }
        }
    }
    
    updateSettingsUI() {
        // 延迟更新UI，确保DOM已加载
        setTimeout(() => {
            const processModeEl = document.getElementById('vidu-process-mode');
            const batchSizeEl = document.getElementById('vidu-batch-size');
            const waitTimeEl = document.getElementById('vidu-wait-time');
            const checkIntervalEl = document.getElementById('vidu-check-interval');
            const maxRetriesEl = document.getElementById('vidu-max-retries');
            const aspectRatioEl = document.getElementById('vidu-aspect-ratio');
            const offPeakModeEl = document.getElementById('vidu-off-peak-mode');
            const generationCountEl = document.getElementById('vidu-generation-count');
            
            if (processModeEl) processModeEl.value = this.settings.processMode || 'queue';
            if (batchSizeEl) batchSizeEl.value = this.settings.batchSize || 4;
            if (waitTimeEl) waitTimeEl.value = this.settings.waitTime || 2;
            if (checkIntervalEl) checkIntervalEl.value = this.settings.checkInterval || 8;
            if (maxRetriesEl) maxRetriesEl.value = this.settings.maxRetries || 5;
            if (aspectRatioEl) aspectRatioEl.value = this.settings.aspectRatio || '9:16';
            if (offPeakModeEl) offPeakModeEl.checked = this.settings.offPeakMode !== false;
            if (generationCountEl) generationCountEl.value = this.settings.generationCount || 1;
            
            // 更新模式显示
            this.toggleProcessMode();
        }, 100);
    }
    
    toggleProcessMode() {
        const mode = document.getElementById('vidu-process-mode').value;
        const queueSettings = document.getElementById('vidu-queue-settings');
        const smartSettings = document.getElementById('vidu-smart-settings');
        
        if (mode === 'queue') {
            queueSettings.style.display = 'block';
            smartSettings.style.display = 'none';
        } else {
            queueSettings.style.display = 'none';
            smartSettings.style.display = 'block';
        }
    }
    
    updateStatus(message) {
        document.getElementById('vidu-status').textContent = message;
    }
    
    updateProgress(percentage) {
        document.getElementById('vidu-progress-bar').style.width = percentage + '%';
    }
    
    logMessage(message, type = 'info') {
        const log = document.getElementById('vidu-log');
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `vidu-log-entry vidu-log-${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        log.appendChild(logEntry);
        log.scrollTop = log.scrollHeight;
    }
    
    clearLog() {
        document.getElementById('vidu-log').innerHTML = '';
    }
    
    

setWorking(isWorking) {
    if (!this.floatingBall) return;
    if (isWorking) {
        this.floatingBall.classList.add('processing');
    } else {
        if (!this.isProcessing) {
            this.floatingBall.classList.remove('processing');
        }
    }
}

clearAll() {
    this.selectedImages = [];
    this.prompts = [];
    document.getElementById('vidu-prompt-textarea').value = '';
    this.updateImagePreview();
    this.checkReadyState();
    this.clearLog();
    this.updateProgress(0);
    this.logMessage('已清空所有数据', 'info');
}

updateSettings() {
    this.settings = {
        processMode: document.getElementById('vidu-process-mode').value,
        batchSize: parseInt(document.getElementById('vidu-batch-size').value),
        waitTime: parseInt(document.getElementById('vidu-wait-time').value),
        checkInterval: parseInt(document.getElementById('vidu-check-interval').value),
        maxRetries: parseInt(document.getElementById('vidu-max-retries').value)
    };

    this.saveSettings();
}

saveSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ videuSettings: this.settings });
    } else {
        // 降级到localStorage
        localStorage.setItem('videuSettings', JSON.stringify(this.settings));
    }
}

loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['videuSettings'], (result) => {
            if (result.videuSettings) {
                this.settings = { ...this.settings, ...result.videuSettings };
                this.updateSettingsUI();
            }
        });
    } else {
        // 降级到localStorage
        try {
            const saved = localStorage.getItem('videuSettings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
                this.updateSettingsUI();
            }
        } catch (error) {
            console.log('加载设置失败:', error);
        }
    }
}

updateSettingsUI() {
    // 延迟更新UI，确保DOM已加载
    setTimeout(() => {
        const processModeEl = document.getElementById('vidu-process-mode');
        const batchSizeEl = document.getElementById('vidu-batch-size');
        const waitTimeEl = document.getElementById('vidu-wait-time');
        const checkIntervalEl = document.getElementById('vidu-check-interval');
        const maxRetriesEl = document.getElementById('vidu-max-retries');

        if (processModeEl) processModeEl.value = this.settings.processMode || 'queue';
        if (batchSizeEl) batchSizeEl.value = this.settings.batchSize || 4;
        if (waitTimeEl) waitTimeEl.value = this.settings.waitTime || 2;
        if (checkIntervalEl) checkIntervalEl.value = this.settings.checkInterval || 8;
        if (maxRetriesEl) maxRetriesEl.value = this.settings.maxRetries || 5;

        // 更新模式显示
        this.toggleProcessMode();
    }, 100);
}

toggleProcessMode() {
    const mode = document.getElementById('vidu-process-mode').value;
    const queueSettings = document.getElementById('vidu-queue-settings');
    const smartSettings = document.getElementById('vidu-smart-settings');

    if (mode === 'queue') {
        queueSettings.style.display = 'block';
        smartSettings.style.display = 'none';
    } else {
        queueSettings.style.display = 'none';
        smartSettings.style.display = 'block';
    }
}

updateStatus(message) {
    document.getElementById('vidu-status').textContent = message;
}

updateProgress(percentage) {
    document.getElementById('vidu-progress-bar').style.width = percentage + '%';
}

logMessage(message, type = 'info') {
    const log = document.getElementById('vidu-log');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `vidu-log-entry vidu-log-${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;

    log.appendChild(logEntry);
    log.scrollTop = log.scrollHeight;
}

clearLog() {
    document.getElementById('vidu-log').innerHTML = '';
}

async clickClearButton() {
    console.log('[VIDU-DBG] clickClearButton:start', '开始查找并点击清空按钮');
    const preferSelectors = [
        'svg.cursor-pointer',
        'svg.cursor-pointer.text-base',
        'svg[width="1em"][height="1em"].cursor-pointer',
        'svg[class*="cursor-pointer"][class*="text-base"]',
        'svg[class*="cursor"][class*="pointer"]',
        '[aria-label*="删除"]',
        '[aria-label*="清空"]',
        '[title*="删除"]',
        '[title*="清空"]'
    ];
    let clearButton = null;

    // 0) 首帧区内优先：XPath + CSS（更靠右下优先）
    try {
        const zone = this.findFirstFrameZone();
        const zoneRect = zone ? { x: Math.round(zone.getBoundingClientRect().left), y: Math.round(zone.getBoundingClientRect().top), w: Math.round(zone.getBoundingClientRect().width), h: Math.round(zone.getBoundingClientRect().height) } : null;
        console.log('[VIDU-DBG] clickClearButton:zone', 'zoneFound:', !!zone, 'zoneRect:', JSON.stringify(zoneRect));
        if (zone) {
            const xres = document.evaluate('//*[local-name()="svg"][contains(@class, "cursor-pointer")]', zone, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            const candidates = [];
            for (let i = 0; i < xres.snapshotLength; i++) {
                const n = xres.snapshotItem(i);
                if (!this.isInsideOurUI(n) && this.isElementVisible(n)) candidates.push(this.resolveClickableNode(n));
            }
            const cssAdds = Array.from(zone.querySelectorAll('svg.cursor-pointer, svg[width="1em"][height="1em"].cursor-pointer, [title*="删除"], [title*="清空"], [aria-label*="删除"], [aria-label*="清空"]'))
                .filter(n => !this.isInsideOurUI(n) && this.isElementVisible(n))
                .map(n => this.resolveClickableNode(n));
            for (const c of cssAdds) if (!candidates.includes(c)) candidates.push(c);
            console.log('[VIDU-DBG] clickClearButton:candidates', 'xpathCount:', xres.snapshotLength, 'cssCount:', cssAdds.length, 'totalCandidates:', candidates.length);
            if (candidates.length > 0) {
                const zr = zone.getBoundingClientRect();
                const zx = zr.left + zr.width;
                const zy = zr.top + zr.height;
                candidates.sort((a, b) => {
                    const ra = a.getBoundingClientRect();
                    const rb = b.getBoundingClientRect();
                    const ca = Math.abs((ra.left + ra.width/2) - zx) + Math.abs((ra.top + ra.height/2) - zy);
                    const cb = Math.abs((rb.left + rb.width/2) - zx) + Math.abs((rb.top + rb.height/2) - zy);
                    return ca - cb;
                });
                clearButton = candidates[0] || null;
            }
        }
    } catch (_) {}

    // 兜底：全局搜索
    if (!clearButton) {
        try {
            clearButton = this.deepQuerySelectorAll([
                'svg.cursor-pointer.text-base',
                'svg[class*="cursor-pointer"]',
                '[class*="trash"]',
                '[class*="delete"]',
                '[class*="clear"]',
                '[aria-label*="删除"]',
                '[aria-label*="清空"]',
                '[title*="删除"]',
                '[title*="清空"]'
            ]).map(n => this.resolveClickableNode(n)).find(n => this.isElementVisible(n)) || null;
        } catch (_) {}
    }

    if (clearButton) {
        const buttonRect = clearButton ? { x: Math.round(clearButton.getBoundingClientRect().left), y: Math.round(clearButton.getBoundingClientRect().top), w: Math.round(clearButton.getBoundingClientRect().width), h: Math.round(clearButton.getBoundingClientRect().height) } : null;
        console.log('[VIDU-DBG] clickClearButton:found', 'buttonRect:', JSON.stringify(buttonRect), 'buttonTag:', clearButton.tagName, 'buttonClass:', clearButton.className);
        // 拒绝过小按钮（常见错误命中右上角小图标）
        if (!buttonRect || buttonRect.w < 20 || buttonRect.h < 20) {
            console.log('[VIDU-DBG] clickClearButton:button-rejected', 'reason: too small', buttonRect);
            clearButton = null;
        }
        // 禁用滚动，避免页面布局变化
        // try { clearButton.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
        if (clearButton) {
            this.attemptClick(clearButton);
            this.logMessage('已点击清空按钮', 'info');
            console.log('[VIDU-DBG] clickClearButton:clicked', '已执行点击操作');
            await this.sleep(600);
        }
        // 点击后多次校验重试，确保首帧区清空
        for (let i = 0; i < 2; i++) {
            const zoneCleared = this.isFirstFrameZoneEmpty();
            console.log('[VIDU-DBG] clickClearButton:verify', 'attempt:', i + 1, 'isEmpty:', zoneCleared);
            if (zoneCleared) break;
            try { this.attemptClick(clearButton); } catch (_) {}
            await this.sleep(500);
        }
        console.log('[VIDU-DBG] clickClearButton:end', '清空按钮处理完成');
    } else {
        console.log('[VIDU-DBG] clickClearButton:notfound', '未找到清空按钮，跳过清空步骤');
        this.logMessage('未找到清空按钮，跳过清空步骤', 'warning');
        await this.sleep(500);
    }
}

async waitForPageReset() {
    // 等待页面恢复到初始状态，并在必要时主动清空
    const maxWait = 12000; // 最多等待12秒
    const start = Date.now();
    let attempts = 0;

    while (Date.now() - start < maxWait) {
        const zoneEmpty = this.isFirstFrameZoneEmpty();
        const promptEl = this.queryPromptInputElement();
        const promptEmpty = !promptEl ||
            (promptEl.tagName ? !promptEl.value || promptEl.value.trim() === '' :
             !promptEl.textContent || promptEl.textContent.trim() === '');

        if (zoneEmpty && promptEmpty) {
            this.logMessage('页面已重置', 'info');
            return;
        }

        attempts++;
        if (attempts === 4 || attempts === 8) {
            // 再次尝试点击清空
            try { await this.clickClearButton(); } catch (_) {}
            // 主动清空提示词
            try {
                const el = this.queryPromptInputElement();
                if (el) {
                    if (el.tagName && (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input')) {
                        el.value = '';
                    } else {
                        el.textContent = '';
                    }
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } catch (_) {}
            // 主动清空 file input
            try {
                const fi = this.chooseFirstFrameFileInput();
                if (fi) {
                    try { fi.value = ''; } catch (_) {}
                    try { fi.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
                    try { fi.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
                }
            } catch (_) {}
        }
        
        await this.sleep(400);
    }
    this.logMessage('页面重置超时，继续执行', 'warning');
}

    // 参考生视频页面专用方法
    async switchToReferenceTab() {
        if (this.pageType !== 'reference') {
            console.log('当前页面不是参考生视频页面，无需切换标签');
            return;
        }
        
        // 查找并点击"参考生视频"标签
        const referenceTab = this.findReferenceTab();
        if (referenceTab) {
            this.attemptClick(referenceTab);
            await this.sleep(1000);
            console.log('已切换到参考生视频标签');
        }
    }
    
    findReferenceTab() {
        const tabs = this.deepQuerySelectorAll([
            'button[aria-selected]',
            'button[role="tab"]',
            'div[role="tab"]'
        ]);
        
        for (const tab of tabs) {
            const text = (tab.textContent || tab.innerText || '').trim();
            if (text.includes('参考生视频') || text.includes('参考')) {
                return tab;
            }
        }
        return null;
    }
    
    async clickSubjectLibraryButton() {
        this.logMessage('正在查找主体库按钮...', 'info');
        
        const subjectLibraryBtn = this.findSubjectLibraryButton();
        if (subjectLibraryBtn) {
            this.logMessage(`找到主体库按钮: ${subjectLibraryBtn.textContent}`, 'info');
            this.attemptClick(subjectLibraryBtn);
            await this.sleep(2000);
            this.logMessage('已点击主体库按钮', 'success');
        } else {
            this.logMessage('未找到主体库按钮', 'warning');
            throw new Error('未找到主体库按钮');
        }
    }
    
    findSubjectLibraryButton() {
        const buttons = this.deepQuerySelectorAll([
            'button',
            '[role="button"]',
            'div[class*="cursor-pointer"]'
        ]);
        
        for (const button of buttons) {
            const text = (button.textContent || button.innerText || '').trim();
            if (text.includes('主体库') || text.includes('主体')) {
                return button;
            }
        }
        return null;
    }
    
    async enableOffPeakMode() {
        this.logMessage('开始查找错峰模式开关...', 'info');
        
        const offPeakToggle = this.findOffPeakToggle();
        if (offPeakToggle) {
            this.logMessage(`找到错峰模式开关: ${offPeakToggle.tagName} ${offPeakToggle.className}`, 'info');
            
            const isEnabled = offPeakToggle.getAttribute('aria-checked') === 'true' || 
                             offPeakToggle.getAttribute('data-state') === 'checked' ||
                             offPeakToggle.checked === true;
            
            if (!isEnabled) {
                this.logMessage('尝试启用错峰模式...', 'info');
                this.attemptClick(offPeakToggle);
                await this.sleep(500);
                this.logMessage('已启用错峰模式', 'success');
            } else {
                this.logMessage('错峰模式已启用', 'info');
            }
        } else {
            this.logMessage('未找到错峰模式开关，请手动设置', 'warning');
        }
    }
    
    findOffPeakToggle() {
        this.logMessage('开始查找错峰模式开关...', 'info');
        
        // 1. 查找所有可能的开关元素 (button[role="switch"])
        const allSwitches = this.deepQuerySelectorAll(['button[role="switch"]']).filter(el => {
            if (this.isInsideOurUI(el)) return false; // 排除插件自身的UI元素
            const rect = el.getBoundingClientRect();
            // 确保开关在左侧主页面区域
            return rect.left < window.innerWidth * 0.7;
        });

        this.logMessage(`找到 ${allSwitches.length} 个可能的开关元素`, 'info');

        // 2. 遍历这些开关，检查它们的祖先元素是否包含"错峰模式"文本
        for (const toggle of allSwitches) {
            let currentElement = toggle;
            let foundOffPeakTextInAncestor = false;
            // 向上遍历最多5层父元素，查找包含"错峰模式"文本的祖先
            for (let i = 0; i < 5 && currentElement; i++) {
                const text = (currentElement.textContent || currentElement.innerText || '').trim();
                if (text.includes('错峰模式')) {
                    foundOffPeakTextInAncestor = true;
                    break;
                }
                currentElement = currentElement.parentElement;
            }

            this.logMessage(`检查开关: ${toggle.tagName} ${toggle.className} | 祖先包含错峰文本=${foundOffPeakTextInAncestor}`, 'info');

            if (foundOffPeakTextInAncestor) {
                this.logMessage(`找到错峰模式开关: ${toggle.tagName} ${toggle.className}`, 'info');
                this.logMessage(`开关状态: aria-checked="${toggle.getAttribute('aria-checked')}" data-state="${toggle.getAttribute('data-state')}"`, 'info');
                return toggle;
            }
        }

        this.logMessage('未找到错峰模式开关', 'warning');
        return null;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // 切换到参考生视频模式
    async switchToReferenceMode() {
        try {
            this.logMessage('正在切换到参考生视频模式...', 'info');
            
            // 1. 跳转到参考生视频页面
            window.location.href = 'https://www.vidu.cn/create/character2video';
            
            this.logMessage('正在跳转到参考生视频页面...', 'info');
            
        } catch (error) {
            this.logMessage(`切换到参考生视频模式失败: ${error.message}`, 'error');
        }
    }
    
    // 更新UI为参考生视频模式
    updateUIForReferenceMode() {
        // 更新页面类型
        this.pageType = 'reference';
        
        // 隐藏图片上传区域
        const uploadSection = document.getElementById('vidu-upload-section');
        const referenceSection = document.getElementById('vidu-reference-section');
        const referenceActions = document.getElementById('vidu-reference-actions');
        const imageCountEl = document.getElementById('vidu-image-count');
        
        uploadSection.style.display = 'none';
        referenceSection.style.display = 'block';
        referenceActions.style.display = 'none';
        imageCountEl.style.display = 'none';
        
        // 更新页面类型指示器
        const pageTypeEl = document.getElementById('vidu-page-type');
        pageTypeEl.textContent = '参考生视频模式';
        pageTypeEl.style.color = '#4CAF50';
        
        // 更新提示词占位符
        const promptTextarea = document.getElementById('vidu-prompt-textarea');
        promptTextarea.placeholder = '请粘贴提示词，每行一个提示词\n例如：\n女孩开心地笑了\n男孩在公园里跑步\n夕阳下的海滩风景\n\n注意：参考生视频模式下，每个提示词将生成一个视频';
        
        // 重新检查就绪状态
        this.checkReadyState();
    }
    
    // 应用视频生成设置
    async applyVideoSettings() {
        try {
            this.logMessage('开始应用视频生成设置...', 'info');
            
            // 1. 设置宽高比
            this.logMessage(`尝试设置宽高比为: ${this.settings.aspectRatio}`, 'info');
            await this.setAspectRatio(this.settings.aspectRatio);
            
            // 2. 设置错峰模式
            if (this.settings.offPeakMode) {
                this.logMessage('尝试启用错峰模式', 'info');
                await this.enableOffPeakMode();
            } else {
                this.logMessage('错峰模式已关闭', 'info');
            }
            
            // 3. 设置生成数量
            this.logMessage(`尝试设置生成数量为: ${this.settings.generationCount}`, 'info');
            await this.setGenerationCount(this.settings.generationCount);
            
            this.logMessage(`视频设置应用完成: 宽高比=${this.settings.aspectRatio}, 错峰模式=${this.settings.offPeakMode}, 数量=${this.settings.generationCount}`, 'success');
            
        } catch (error) {
            this.logMessage(`应用视频设置失败: ${error.message}`, 'error');
        }
    }
    
    // 设置宽高比
    async setAspectRatio(aspectRatio) {
        this.logMessage(`开始查找宽高比设置控件: ${aspectRatio}`, 'info');
        
        // 根据实际HTML结构查找宽高比按钮
        const aspectRatioButton = this.deepQuerySelectorAll([
            'button[role="combobox"]',
            'button[aria-controls*="radix"]'
        ]).find(el => {
            if (this.isInsideOurUI(el)) return false;
            
            const rect = el.getBoundingClientRect();
            const text = el.textContent || el.innerText || '';
            
            // 检查是否在左侧主页面区域
            const isInLeftPanel = rect.left < window.innerWidth * 0.7;
            
            // 检查是否包含宽高比相关文本
            const hasAspectRatioText = (
                text.includes('16:9') ||
                text.includes('9:16') ||
                text.includes('1:1') ||
                text.includes('4:3') ||
                text.includes('3:4')
            );
            
            return isInLeftPanel && hasAspectRatioText;
        });
        
        if (aspectRatioButton) {
            this.logMessage(`找到宽高比按钮: ${aspectRatioButton.textContent}`, 'info');
            this.attemptClick(aspectRatioButton);
            await this.sleep(1000);
            
            // 查找下拉选项
            const options = this.deepQuerySelectorAll([
                '[role="option"]',
                '[data-radix-collection-item]',
                'div[class*="option"]'
            ]);
            
            this.logMessage(`找到 ${options.length} 个选项`, 'info');
            
            // 查找目标宽高比选项
            const targetOption = options.find(option => {
                const text = option.textContent || option.innerText || '';
                return text.includes(aspectRatio);
            });
            
            if (targetOption) {
                this.logMessage(`找到目标选项: ${targetOption.textContent}`, 'info');
                this.attemptClick(targetOption);
                await this.sleep(500);
                this.logMessage(`已设置宽高比为: ${aspectRatio}`, 'success');
                return;
            } else {
                this.logMessage(`未找到宽高比选项: ${aspectRatio}`, 'warning');
            }
        } else {
            this.logMessage(`未找到宽高比设置控件`, 'warning');
        }
    }
    
    // 设置生成数量
    async setGenerationCount(count) {
        this.logMessage(`开始查找数量设置控件: ${count}`, 'info');
        
        // 根据实际HTML结构查找数量按钮组
        const quantityButtons = this.deepQuerySelectorAll([
            'button[role="radio"]',
            'button[data-radix-collection-item]'
        ]).filter(button => {
            if (this.isInsideOurUI(button)) return false;
            
            const rect = button.getBoundingClientRect();
            const text = button.textContent || button.innerText || '';
            
            // 检查是否在左侧主页面区域
            const isInLeftPanel = rect.left < window.innerWidth * 0.7;
            
            // 检查是否包含数量相关文本
            const hasCountText = (
                text.includes('1') || text.includes('2') || 
                text.includes('3') || text.includes('4')
            );
            
            return isInLeftPanel && hasCountText;
        });
        
        this.logMessage(`找到 ${quantityButtons.length} 个数量按钮`, 'info');
        
        // 查找目标数量按钮
        const targetButton = quantityButtons.find(button => {
            const text = button.textContent || button.innerText || '';
            return text.includes(count.toString());
        });
        
        if (targetButton) {
            this.logMessage(`找到目标数量按钮: ${targetButton.textContent}`, 'info');
            this.attemptClick(targetButton);
            await this.sleep(500);
            this.logMessage(`已设置生成数量为: ${count}`, 'success');
        } else {
            this.logMessage(`未找到数量 ${count} 的按钮`, 'warning');
        }
    }
    
    // 在左侧主页面输入提示词
    async inputPromptToMainPage(promptText) {
        this.logMessage('正在查找主页面提示词输入框...', 'info');
        
        // 根据实际HTML结构查找提示词输入框
        const promptElement = this.deepQuerySelectorAll([
            'div[contenteditable="true"]',
            'div[class*="tiptap"]',
            'div[class*="ProseMirror"]'
        ]).find(el => {
            if (this.isInsideOurUI(el)) return false;
            
            const rect = el.getBoundingClientRect();
            const className = String(el.className || '');
            
            // 检查是否在左侧主页面区域
            const isInLeftPanel = rect.left < window.innerWidth * 0.7;
            
            // 检查是否是tiptap编辑器
            const isTiptapEditor = (
                className.includes('tiptap') ||
                className.includes('ProseMirror') ||
                el.contentEditable === 'true'
            );
            
            return isInLeftPanel && isTiptapEditor;
        });
        
        if (promptElement) {
            this.logMessage(`找到提示词输入框: ${promptElement.tagName} ${promptElement.className}`, 'info');
            await this.tryInputToElement(promptElement, promptText);
        } else {
            this.logMessage('未找到提示词输入框', 'warning');
            throw new Error('未找到主页面提示词输入框');
        }
    }
    
    // 尝试向元素输入文本
    async tryInputToElement(element, promptText) {
        const safeText = (typeof promptText === 'string' && promptText.length > 0) ? promptText : ' ';
        
        this.logMessage(`尝试向元素输入文本: ${element.tagName} ${element.className}`, 'info');
        
        try {
            if (element.tagName && (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input')) {
                element.value = '';
                element.focus();
                element.value = safeText;
            } else {
                element.focus();
                element.textContent = '';
                element.textContent = safeText;
            }
            
            // 触发各种事件
            const events = ['input', 'change', 'keyup', 'blur'];
            events.forEach(eventType => {
                const event = new Event(eventType, { bubbles: true });
                element.dispatchEvent(event);
            });
            
            await this.sleep(500);
            this.logMessage(`已在主页面输入提示词: ${safeText.substring(0, 30)}...`, 'success');
            
        } catch (error) {
            this.logMessage(`输入文本失败: ${error.message}`, 'error');
            throw error;
        }
    }
    
    // 点击左侧主页面的创作按钮
    async clickMainCreateButton() {
        this.logMessage('正在查找主页面创作按钮...', 'info');
        
        // 根据实际HTML结构查找创作按钮
        const createButton = this.deepQuerySelectorAll([
            'button[id="submit-button"]',
            'button[class*="submit"]',
            'button'
        ]).find(el => {
            if (this.isInsideOurUI(el)) return false;
            
            const text = (el.textContent || el.innerText || '').trim();
            const rect = el.getBoundingClientRect();
            const id = el.getAttribute('id') || '';
            
            return (
                (text.includes('创作') || id.includes('submit')) &&
                rect.width > 100 && rect.height > 40 && // 确保是主要按钮
                rect.left < window.innerWidth * 0.7 // 确保在左侧区域
            );
        });
        
        if (createButton) {
            this.logMessage(`找到创作按钮: ${createButton.textContent}`, 'info');
            this.attemptClick(createButton);
            await this.sleep(1000);
            this.logMessage('已点击主页面创作按钮', 'success');
        } else {
            this.logMessage('未找到主页面创作按钮', 'warning');
            throw new Error('未找到主页面创作按钮');
        }
    }
    
    // 等待主页面提交完成
    async waitForMainPageSubmission() {
        const maxWait = 15000; // 最多等待15秒
        const start = Date.now();
        
        while (Date.now() - start < maxWait) {
            // 检查是否有成功提示
            const successMessages = this.deepQuerySelectorAll([
                '[class*="success"]',
                '[class*="toast"]',
                '[class*="message"]',
                '[role*="status"]',
                '[aria-live]'
            ]).filter(el => {
                const text = (el.textContent || '').toLowerCase();
                return text.includes('已提交') || text.includes('提交成功') || 
                       text.includes('已加入') || text.includes('开始生成') ||
                       text.includes('处理中') || text.includes('排队');
            });
            
            if (successMessages.length > 0) {
                this.logMessage('主页面提交成功', 'success');
                return;
            }
            
            // 检查创作按钮是否变为禁用状态
            const createButton = this.deepQuerySelectorAll(['button']).find(el => {
                const text = (el.textContent || el.innerText || '').trim();
                return text.includes('创作') && !this.isInsideOurUI(el);
            });
            
            if (createButton && createButton.disabled) {
                this.logMessage('主页面创作按钮已禁用，提交成功', 'success');
                return;
            }
            
            await this.sleep(500);
        }
        
        this.logMessage('主页面提交等待超时', 'warning');
    }
    
    // 清空主页面内容
    async clearMainPageContent() {
        try {
            // 清空提示词输入框
            const promptElement = this.deepQuerySelectorAll([
                'textarea[placeholder*="描述"]',
                'textarea[placeholder*="提示词"]',
                'textarea[maxlength]',
                'textarea'
            ]).find(el => {
                if (this.isInsideOurUI(el)) return false;
                const rect = el.getBoundingClientRect();
                return rect.width > 200 && rect.height > 50;
            });
            
            if (promptElement) {
                if (promptElement.tagName && (promptElement.tagName.toLowerCase() === 'textarea' || promptElement.tagName.toLowerCase() === 'input')) {
                    promptElement.value = '';
                } else {
                    promptElement.textContent = '';
                }
                promptElement.dispatchEvent(new Event('input', { bubbles: true }));
                promptElement.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            // 查找并点击清空按钮
            const clearButton = this.deepQuerySelectorAll([
                'button[class*="clear"]',
                'button[class*="delete"]',
                'button[class*="reset"]',
                'svg[class*="clear"]',
                'svg[class*="delete"]'
            ]).find(el => {
                if (this.isInsideOurUI(el)) return false;
                const text = (el.textContent || el.innerText || '').toLowerCase();
                return text.includes('清空') || text.includes('删除') || text.includes('重置');
            });
            
            if (clearButton) {
                this.attemptClick(clearButton);
                await this.sleep(500);
            }
            
            this.logMessage('已清空主页面内容', 'success');
            
        } catch (error) {
            this.logMessage(`清空主页面内容失败: ${error.message}`, 'warning');
        }
    }
    
    // 分析提示词中的人名，在主体库中选择匹配的主体
    async selectMatchingSubjects(prompt) {
        this.logMessage('正在分析提示词中的人名...', 'info');
        this.logMessage(`完整提示词: ${prompt}`, 'info');
        
        // 提取提示词中可能的人名（改进的姓名模式）
        // 1. 英文姓名（首字母大写，2-10个字母）
        const englishNamePattern = /\b[A-Z][a-z]{1,9}\b/g;
        // 2. 中文姓名（2-4个汉字，排除常见词汇）
        const chineseNamePattern = /[\u4e00-\u9fa5]{2,4}/g;
        
        const englishNames = prompt.match(englishNamePattern) || [];
        const chineseNames = prompt.match(chineseNamePattern) || [];
        
        // 过滤掉常见的中文词汇
        const commonWords = ['杰作', '最佳', '画质', '电影', '高速', '摄影', '在一间', '满阳光', '明亮', '卧室', '站在', '一张', '由一', '整块', '巨大', '鲜嫩', '多汁', '的西', '柚果', '肉构', '成的', '床前', '她面', '朝镜', '俏皮', '地眨', '了眨', '眼她', '突然', '双腿', '弯曲', '奋力', '向上', '跃起', '在空', '中蜷', '缩成', '一个', '完美', '的球', '然后', '以坐', '姿重', '重地', '砸入', '床的', '中心', '瞬间', '床的', '表面', '被她', '的冲', '击力', '撕裂', '无数', '饱满', '的果', '粒囊', '泡同', '时爆', '一股', '强劲', '混合', '着果', '肉纤', '维的', '粉红', '色汁', '液呈', '环形', '向四', '周猛', '烈喷', '射在', '阳光', '下形', '成一', '道绚', '烂的', '水雾'];
        
        const filteredChineseNames = chineseNames.filter(name => !commonWords.includes(name));
        
        const names = [...englishNames, ...filteredChineseNames];
        
        this.logMessage(`在提示词中找到 ${names.length} 个可能的人名: ${names.join(', ')}`, 'info');
        
        if (names.length === 0) {
            this.logMessage('提示词中未找到人名，将选择第一个可用的主体', 'warning');
            // 如果没有找到人名，选择第一个可用的主体
            await this.selectFirstAvailableSubject();
            return;
        }
        
        // 等待主体库弹窗出现
        await this.sleep(2000);
        
        // 查找主体库弹窗中的所有主体卡片
        const allSubjectCards = this.deepQuerySelectorAll([
            'div[data-index]' // 主体卡片容器
        ]).filter(el => {
            if (this.isInsideOurUI(el)) return false;
            
            // 检查是否在弹窗中
            const dialog = el.closest('[role="dialog"]');
            if (!dialog) return false;
            
            return true;
        });
        
        this.logMessage(`弹窗中找到 ${allSubjectCards.length} 个主体卡片`, 'info');
        
        // 打印所有主体的名称
        for (let i = 0; i < allSubjectCards.length; i++) {
            const card = allSubjectCards[i];
            const subjectName = card.textContent.trim();
            this.logMessage(`主体 ${i + 1}: "${subjectName}"`, 'info');
        }
        
        // 查找匹配的主体卡片
        const subjectCards = allSubjectCards.filter(card => {
            const text = (card.textContent || card.innerText || '').trim();
            const allText = text.toLowerCase();
            
            // 检查是否包含人名
            const hasMatch = names.some(name => allText.includes(name.toLowerCase()));
            this.logMessage(`检查主体 "${text}": ${hasMatch ? '匹配' : '不匹配'}`, 'info');
            
            return hasMatch;
        });
        
        this.logMessage(`找到 ${subjectCards.length} 个匹配的主体卡片`, 'info');
        
        if (subjectCards.length === 0) {
            this.logMessage('未找到匹配的主体，将选择第一个可用的主体', 'warning');
            await this.selectFirstAvailableSubject();
            return;
        }
        
        // 对每个匹配的主体卡片进行悬停和点击
        for (const card of subjectCards) {
            try {
                const subjectName = card.textContent.trim();
                this.logMessage(`尝试选择主体: ${subjectName}`, 'info');
                
                // 1. 先悬停在卡片上显示复选框
                this.logMessage(`悬停在主体卡片上: ${subjectName}`, 'info');
                const hoverEvent = new MouseEvent('mouseenter', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                card.dispatchEvent(hoverEvent);
                
                // 等待复选框出现
                await this.sleep(500);
                
                // 2. 查找复选框按钮（现在应该可见了）
                const checkbox = card.querySelector('button[role="checkbox"]');
                
                if (checkbox) {
                    this.logMessage(`找到复选框，点击选择: ${subjectName}`, 'info');
                    
                    // 确保复选框可见
                    checkbox.style.opacity = '1';
                    checkbox.style.pointerEvents = 'auto';
                    
                    // 点击复选框
                    this.attemptClick(checkbox);
                    await this.sleep(500);
                    
                    this.logMessage(`已选择主体: ${subjectName}`, 'success');
                } else {
                    this.logMessage(`未找到复选框: ${subjectName}`, 'warning');
                    
                    // 尝试直接点击卡片
                    this.logMessage(`尝试直接点击卡片: ${subjectName}`, 'info');
                    this.attemptClick(card);
                    await this.sleep(500);
                }
                
                // 3. 移开鼠标
                const leaveEvent = new MouseEvent('mouseleave', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                card.dispatchEvent(leaveEvent);
                
            } catch (error) {
                this.logMessage(`选择主体失败: ${error.message}`, 'warning');
            }
        }
    }
    
    // 选择第一个可用的主体
    async selectFirstAvailableSubject() {
        this.logMessage('正在选择第一个可用的主体...', 'info');
        
        // 等待主体库弹窗出现
        await this.sleep(2000);
        
        // 查找主体库弹窗中的第一个主体卡片
        const firstCard = this.deepQuerySelectorAll([
            'div[data-index]' // 主体卡片容器
        ]).find(el => {
            if (this.isInsideOurUI(el)) return false;
            
            // 检查是否在弹窗中
            const dialog = el.closest('[role="dialog"]');
            if (!dialog) return false;
            
            return true;
        });
        
        if (firstCard) {
            const subjectName = firstCard.textContent.trim();
            this.logMessage(`选择第一个可用主体: ${subjectName}`, 'info');
            
            try {
                // 悬停显示复选框
                const hoverEvent = new MouseEvent('mouseenter', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                firstCard.dispatchEvent(hoverEvent);
                await this.sleep(500);
                
                // 查找并点击复选框
                const checkbox = firstCard.querySelector('button[role="checkbox"]');
                if (checkbox) {
                    checkbox.style.opacity = '1';
                    checkbox.style.pointerEvents = 'auto';
                    this.attemptClick(checkbox);
                    await this.sleep(500);
                    this.logMessage(`已选择主体: ${subjectName}`, 'success');
                } else {
                    this.attemptClick(firstCard);
                    await this.sleep(500);
                }
                
                // 移开鼠标
                const leaveEvent = new MouseEvent('mouseleave', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                firstCard.dispatchEvent(leaveEvent);
                
            } catch (error) {
                this.logMessage(`选择第一个主体失败: ${error.message}`, 'warning');
            }
        } else {
            this.logMessage('未找到任何主体卡片', 'warning');
        }
    }
    
    // 点击确定按钮
    async clickConfirmButton() {
        this.logMessage('正在查找确定按钮...', 'info');
        
        // 查找弹窗中的确定按钮
        const confirmButton = this.deepQuerySelectorAll([
            'button[class*="ShengshuButton"]',
            'button:contains("确定")',
            'button:contains("确认")'
        ]).find(el => {
            if (this.isInsideOurUI(el)) return false;
            
            // 检查是否在弹窗中
            const dialog = el.closest('[role="dialog"]');
            if (!dialog) return false;
            
            const text = (el.textContent || el.innerText || '').trim();
            const rect = el.getBoundingClientRect();
            
            return (
                text.includes('确定') || text.includes('确认') ||
                text.includes('OK') || text.includes('Apply')
            ) && rect.width > 50 && rect.height > 20;
        });
        
        if (confirmButton) {
            this.logMessage(`找到确定按钮: ${confirmButton.textContent}`, 'info');
            this.attemptClick(confirmButton);
            await this.sleep(1000);
            this.logMessage('已点击确定按钮', 'success');
        } else {
            this.logMessage('未找到确定按钮，尝试按ESC键关闭弹窗', 'warning');
            // 尝试按ESC键关闭弹窗
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
            await this.sleep(1000);
        }
    }

}

// 初始化悬浮球
console.log('Vidu悬浮球脚本开始加载...');
console.log('当前URL:', window.location.href);
console.log('文档状态:', document.readyState);

function initFloatingBall() {
    try {
        console.log('正在初始化悬浮球...');
        new VideuFloatingBall();
        console.log('悬浮球初始化完成');
    } catch (error) {
        console.error('悬浮球初始化失败:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM加载完成，初始化悬浮球');
        initFloatingBall();
    });
} else {
    console.log('DOM已加载，立即初始化悬浮球');
    initFloatingBall();
}