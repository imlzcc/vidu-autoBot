// popup.js - 插件弹出窗口的主要逻辑

class VideuBatchProcessor {
    constructor() {
        this.selectedFiles = {
            images: [],
            prompts: []
        };
        this.prompts = [];
        this.isProcessing = false;
        this.currentProgress = 0;
        this.totalTasks = 0;
        this.pageType = this.detectPageType();
        
        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
        this.toggleProcessMode(); // 初始化显示模式
        this.updateUIForPageType();
    }
    
    detectPageType() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const url = tabs[0]?.url || '';
                if (url.includes('/create/reference')) {
                    resolve('reference');
                } else if (url.includes('/create/img2video')) {
                    resolve('img2video');
                } else {
                    resolve('unknown');
                }
            });
        });
    }
    
    initializeElements() {
        this.elements = {
            pageType: document.getElementById('pageType'),
            img2videoSection: document.getElementById('img2videoSection'),
            filePreviewSection: document.getElementById('filePreviewSection'),
            referenceSection: document.getElementById('referenceSection'),
            selectFolder: document.getElementById('selectFolder'),
            folderPath: document.getElementById('folderPath'),
            imageList: document.getElementById('imageList'),
            promptList: document.getElementById('promptList'),
            promptTextarea: document.getElementById('promptTextarea'),
            pastePrompts: document.getElementById('pastePrompts'),
            clearPrompts: document.getElementById('clearPrompts'),
            promptCount: document.getElementById('promptCount'),
            imageCount: document.getElementById('imageCount'),
            taskCount: document.getElementById('taskCount'),
            processMode: document.getElementById('processMode'),
            queueSettings: document.getElementById('queueSettings'),
            smartSettings: document.getElementById('smartSettings'),
            batchSize: document.getElementById('batchSize'),
            waitTime: document.getElementById('waitTime'),
            checkInterval: document.getElementById('checkInterval'),
            maxRetries: document.getElementById('maxRetries'),
            status: document.getElementById('status'),
            progressBar: document.getElementById('progressBar'),
            processLog: document.getElementById('processLog'),
            startProcess: document.getElementById('startProcess'),
            stopProcess: document.getElementById('stopProcess'),
            clearLog: document.getElementById('clearLog')
        };
    }
    
    bindEvents() {
        this.elements.selectFolder.addEventListener('click', () => this.selectFolder());
        this.elements.startProcess.addEventListener('click', () => this.startProcessing());
        this.elements.stopProcess.addEventListener('click', () => this.stopProcessing());
        this.elements.clearLog.addEventListener('click', () => this.clearLog());
        
        // 提示词相关事件
        this.elements.promptTextarea.addEventListener('input', () => this.updatePrompts());
        this.elements.pastePrompts.addEventListener('click', () => this.pastePrompts());
        this.elements.clearPrompts.addEventListener('click', () => this.clearPrompts());
        
        // 处理模式切换
        this.elements.processMode.addEventListener('change', () => this.toggleProcessMode());
        
        // 保存设置
        [this.elements.processMode, this.elements.batchSize, this.elements.waitTime, 
         this.elements.checkInterval, this.elements.maxRetries].forEach(element => {
            element.addEventListener('change', () => this.saveSettings());
        });
    }
    
    async selectFolder() {
        try {
            // 使用File System Access API选择文件夹
            if ('showDirectoryPicker' in window) {
                const dirHandle = await window.showDirectoryPicker();
                await this.processDirectory(dirHandle);
            } else {
                // 降级方案：使用文件输入
                this.showFileInputFallback();
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.logMessage('选择文件夹时出错: ' + error.message, 'error');
            }
        }
    }
    
    showFileInputFallback() {
        // 创建隐藏的文件输入元素
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.jpg,.jpeg,.png,.webp,.txt';
        input.webkitdirectory = true; // 允许选择文件夹
        
        input.addEventListener('change', (event) => {
            const files = Array.from(event.target.files);
            this.processFileList(files);
        });
        
        input.click();
    }
    
    async processDirectory(dirHandle) {
        const files = [];
        
        for await (const [name, handle] of dirHandle.entries()) {
            if (handle.kind === 'file') {
                const file = await handle.getFile();
                files.push(file);
            }
        }
        
        this.elements.folderPath.textContent = dirHandle.name;
        this.processFileList(files);
    }
    
    processFileList(files) {
        this.selectedFiles.images = [];
        this.selectedFiles.prompts = [];
        
        files.forEach(file => {
            const extension = file.name.toLowerCase().split('.').pop();
            
            if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
                this.selectedFiles.images.push(file);
            } else if (extension === 'txt') {
                this.selectedFiles.prompts.push(file);
            }
        });
        
        // 排序图片文件
        this.sortImageFiles();
        this.selectedFiles.prompts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        
        // 更新UI显示
        this.updateFilePreview();
        
        // 检查是否可以开始处理
        this.checkReadyToProcess();
    }
    
    sortImageFiles() {
        this.selectedFiles.images.sort((a, b) => {
            const getNumber = (filename) => {
                // 提取文件名中的数字
                const match = filename.match(/(\d+)|shot_(\d+)/i);
                if (match) {
                    return parseInt(match[1] || match[2]);
                }
                return 0;
            };
            
            return getNumber(a.name) - getNumber(b.name);
        });
    }
    
    updateFilePreview() {
        // 显示图片文件
        this.elements.imageList.innerHTML = this.selectedFiles.images
            .map((file, index) => `<div>${index + 1}. ${file.name}</div>`)
            .join('') || '未找到图片文件';
        
        // 显示Prompt文件
        this.elements.promptList.innerHTML = this.selectedFiles.prompts
            .map((file, index) => `<div>${index + 1}. ${file.name}</div>`)
            .join('') || '未找到Prompt文件';
    }
    
    toggleProcessMode() {
        const mode = this.elements.processMode.value;
        
        if (mode === 'queue') {
            this.elements.queueSettings.style.display = 'block';
            this.elements.smartSettings.style.display = 'none';
        } else {
            this.elements.queueSettings.style.display = 'none';
            this.elements.smartSettings.style.display = 'block';
        }
    }
    
    checkReadyToProcess() {
        const hasImages = this.selectedFiles.images.length > 0;
        const hasPrompts = this.selectedFiles.prompts.length > 0;
        
        this.elements.startProcess.disabled = !hasImages || !hasPrompts || this.isProcessing;
        
        if (hasImages && hasPrompts) {
            const mode = this.elements.processMode.value;
            const modeText = mode === 'queue' ? '排队模式' : '智能检测模式';
            this.updateStatus(`准备就绪 (${modeText}) - 找到 ${this.selectedFiles.images.length} 张图片和 ${this.selectedFiles.prompts.length} 个Prompt文件`);
        } else if (!hasImages && !hasPrompts) {
            this.updateStatus('请选择包含图片和Prompt文件的文件夹');
        } else if (!hasImages) {
            this.updateStatus('未找到图片文件 (支持: jpg, png, webp)');
        } else {
            this.updateStatus('未找到Prompt文件 (支持: txt)');
        }
    }
    
    async startProcessing() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.elements.startProcess.disabled = true;
        this.elements.stopProcess.disabled = false;
        
        try {
            // 读取Prompt文件内容
            const prompts = await this.readPromptFiles();
            
            // 准备处理数据
            const processData = {
                images: this.selectedFiles.images,
                prompts: prompts,
                settings: {
                    processMode: this.elements.processMode.value,
                    batchSize: parseInt(this.elements.batchSize.value),
                    waitTime: parseInt(this.elements.waitTime.value),
                    checkInterval: parseInt(this.elements.checkInterval.value),
                    maxRetries: parseInt(this.elements.maxRetries.value)
                }
            };
            
            this.totalTasks = Math.min(this.selectedFiles.images.length, prompts.length);
            this.currentProgress = 0;
            this.updateProgress(0);
            
            this.logMessage('开始批量处理...', 'info');
            
            // 发送消息给background script
            chrome.runtime.sendMessage({
                action: 'processFiles',
                data: processData
            }, (response) => {
                if (response && response.success) {
                    this.logMessage('处理完成!', 'success');
                } else {
                    this.logMessage('处理失败: ' + (response?.error || '未知错误'), 'error');
                }
                this.stopProcessing();
            });
            
        } catch (error) {
            this.logMessage('启动处理时出错: ' + error.message, 'error');
            this.stopProcessing();
        }
    }
    
    async readPromptFiles() {
        const prompts = [];
        
        const promptFiles = [...this.selectedFiles.prompts].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        for (const file of promptFiles) {
            try {
                const content = await this.readFileAsText(file);
                const lines = content.split(/\r?\n/);
                prompts.push(...lines);
            } catch (error) {
                this.logMessage(`读取文件 ${file.name} 失败: ${error.message}`, 'error');
            }
        }
        
        return prompts;
    }
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file, 'utf-8');
        });
    }
    
    stopProcessing() {
        this.isProcessing = false;
        this.elements.startProcess.disabled = false;
        this.elements.stopProcess.disabled = true;
        this.updateStatus('处理已停止');
    }
    
    updateStatus(message) {
        this.elements.status.textContent = message;
    }
    
    updateProgress(percentage) {
        this.elements.progressBar.style.width = percentage + '%';
    }
    
    logMessage(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        this.elements.processLog.appendChild(logEntry);
        this.elements.processLog.scrollTop = this.elements.processLog.scrollHeight;
    }
    
    clearLog() {
        this.elements.processLog.innerHTML = '';
    }
    
    saveSettings() {
        const settings = {
            processMode: this.elements.processMode.value,
            batchSize: parseInt(this.elements.batchSize.value),
            waitTime: parseInt(this.elements.waitTime.value),
            checkInterval: parseInt(this.elements.checkInterval.value),
            maxRetries: parseInt(this.elements.maxRetries.value)
        };
        
        chrome.storage.local.set({ settings: settings });
    }
    
    loadSettings() {
        chrome.storage.local.get(['settings'], (result) => {
            if (result.settings) {
                const settings = result.settings;
                this.elements.processMode.value = settings.processMode || 'queue';
                this.elements.batchSize.value = settings.batchSize || 4;
                this.elements.waitTime.value = settings.waitTime || 2;
                this.elements.checkInterval.value = settings.checkInterval || 8;
                this.elements.maxRetries.value = settings.maxRetries || 5;
            }
        });
    }
    
    async updateUIForPageType() {
        const pageType = await this.pageType;
        const pageTypeEl = this.elements.pageType;
        const img2videoSection = this.elements.img2videoSection;
        const filePreviewSection = this.elements.filePreviewSection;
        const referenceSection = this.elements.referenceSection;
        const imageCountEl = this.elements.imageCount;
        
        if (pageType === 'reference') {
            pageTypeEl.textContent = '参考生视频模式';
            pageTypeEl.style.color = '#4CAF50';
            img2videoSection.style.display = 'none';
            filePreviewSection.style.display = 'none';
            referenceSection.style.display = 'block';
            imageCountEl.style.display = 'none';
        } else if (pageType === 'img2video') {
            pageTypeEl.textContent = '图生视频模式';
            pageTypeEl.style.color = '#2196F3';
            img2videoSection.style.display = 'block';
            filePreviewSection.style.display = 'block';
            referenceSection.style.display = 'none';
            imageCountEl.style.display = 'inline';
        } else {
            pageTypeEl.textContent = '未知页面类型';
            pageTypeEl.style.color = '#FF9800';
            img2videoSection.style.display = 'block';
            filePreviewSection.style.display = 'block';
            referenceSection.style.display = 'none';
            imageCountEl.style.display = 'inline';
        }
    }
    
    updatePrompts() {
        const textarea = this.elements.promptTextarea;
        this.prompts = textarea.value
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        this.updateCounts();
        this.checkReadyToProcess();
    }
    
    async pastePrompts() {
        try {
            const text = await navigator.clipboard.readText();
            if (text.trim()) {
                this.elements.promptTextarea.value = text.trim();
                this.updatePrompts();
                this.logMessage(`已粘贴 ${this.prompts.length} 个提示词`, 'success');
            } else {
                this.logMessage('剪贴板为空', 'warning');
            }
        } catch (error) {
            this.logMessage('粘贴失败，请手动粘贴: ' + error.message, 'error');
            this.elements.promptTextarea.focus();
        }
    }
    
    clearPrompts() {
        this.elements.promptTextarea.value = '';
        this.updatePrompts();
        this.logMessage('已清空提示词', 'info');
    }
    
    updateCounts() {
        const promptCount = this.prompts.length;
        const imageCount = this.selectedFiles.images.length;
        
        this.elements.promptCount.textContent = promptCount;
        this.elements.imageCount.textContent = imageCount;
        
        if (this.pageType === 'reference') {
            // 参考生视频模式：任务数等于提示词数
            const taskCount = promptCount;
            this.elements.taskCount.textContent = taskCount;
        } else {
            // 图生视频模式：任务数等于图片数和提示词数的最小值
            const taskCount = Math.min(promptCount, imageCount);
            this.elements.taskCount.textContent = taskCount;
        }
    }
    
    async checkReadyToProcess() {
        const pageType = await this.pageType;
        const hasImages = this.selectedFiles.images.length > 0;
        const hasPrompts = this.prompts.length > 0;
        let isReady = false;
        
        if (pageType === 'reference') {
            // 参考生视频模式：只需要提示词
            isReady = hasPrompts && !this.isProcessing;
        } else {
            // 图生视频模式：需要图片和提示词
            isReady = hasImages && hasPrompts && !this.isProcessing;
        }
        
        this.elements.startProcess.disabled = !isReady;
        
        if (pageType === 'reference') {
            if (hasPrompts) {
                const mode = this.elements.processMode.value;
                const modeText = mode === 'queue' ? '排队模式' : '智能检测模式';
                this.updateStatus(`准备就绪 (${modeText}) - ${this.prompts.length} 个提示词待处理`);
            } else {
                this.updateStatus('请输入提示词');
            }
        } else {
            if (hasImages && hasPrompts) {
                const mode = this.elements.processMode.value;
                const modeText = mode === 'queue' ? '排队模式' : '智能检测模式';
                const taskCount = Math.min(this.selectedFiles.images.length, this.prompts.length);
                this.updateStatus(`准备就绪 (${modeText}) - 找到 ${this.selectedFiles.images.length} 张图片和 ${this.prompts.length} 个提示词`);
            } else if (!hasImages && !hasPrompts) {
                this.updateStatus('请选择包含图片和Prompt文件的文件夹或输入提示词');
            } else if (!hasImages) {
                this.updateStatus('未找到图片文件 (支持: jpg, png, webp)');
            } else {
                this.updateStatus('请输入提示词');
            }
        }
    }
    
    async startProcessing() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.elements.startProcess.disabled = true;
        this.elements.stopProcess.disabled = false;
        
        try {
            const pageType = await this.pageType;
            let processData;
            
            if (pageType === 'reference') {
                // 参考生视频模式：只需要提示词
                processData = {
                    images: [], // 参考生视频模式不需要图片
                    prompts: this.prompts,
                    settings: {
                        processMode: this.elements.processMode.value,
                        batchSize: parseInt(this.elements.batchSize.value),
                        waitTime: parseInt(this.elements.waitTime.value),
                        checkInterval: parseInt(this.elements.checkInterval.value),
                        maxRetries: parseInt(this.elements.maxRetries.value)
                    }
                };
                this.totalTasks = this.prompts.length;
            } else {
                // 图生视频模式：需要图片和提示词
                const prompts = await this.readPromptFiles();
                processData = {
                    images: this.selectedFiles.images,
                    prompts: prompts,
                    settings: {
                        processMode: this.elements.processMode.value,
                        batchSize: parseInt(this.elements.batchSize.value),
                        waitTime: parseInt(this.elements.waitTime.value),
                        checkInterval: parseInt(this.elements.checkInterval.value),
                        maxRetries: parseInt(this.elements.maxRetries.value)
                    }
                };
                this.totalTasks = Math.min(this.selectedFiles.images.length, prompts.length);
            }
            
            this.currentProgress = 0;
            this.updateProgress(0);
            
            this.logMessage('开始批量处理...', 'info');
            
            // 发送消息给background script
            chrome.runtime.sendMessage({
                action: 'processFiles',
                data: processData
            }, (response) => {
                if (response && response.success) {
                    this.logMessage('处理完成!', 'success');
                } else {
                    this.logMessage('处理失败: ' + (response?.error || '未知错误'), 'error');
                }
                this.stopProcessing();
            });
            
        } catch (error) {
            this.logMessage('启动处理时出错: ' + error.message, 'error');
            this.stopProcessing();
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new VideuBatchProcessor();
});