// content.js - 与Vidu网站交互的内容脚本

class VideuPageController {
    constructor() {
        this.isProcessing = false;
        this.currentTaskIndex = 0;
        this.totalTasks = 0;
        this.processQueue = [];
        this.settings = {};
        this.processedCount = 0;
        this.lastPrompt = '';
        this.pageType = this.detectPageType();
        
        this.initializeController();
    }
    
    detectPageType() {
        const url = window.location.href;
        console.log('检测页面类型，当前URL:', url);
        
        if (url.includes('/create/reference')) {
            console.log('检测到参考生视频页面');
            return 'reference';
        } else if (url.includes('/create/img2video')) {
            console.log('检测到图生视频页面');
            return 'img2video';
        } else if (url.includes('/create/text2video')) {
            console.log('检测到文生视频页面');
            return 'text2video';
        }
        
        console.log('未检测到支持的页面类型');
        return 'unknown';
    }
    
    initializeController() {
        // 监听来自background script的消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'startBatchProcess') {
                this.startBatchProcess(request.images, request.prompts, request.settings)
                    .then(result => sendResponse(result))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // 保持消息通道开放
            }
        });
        
        console.log('Vidu批量处理控制器已初始化');
    }
    
    
    
    async startBatchProcess(images, prompts, settings) {
        if (this.isProcessing) {
            return { success: false, error: '已有处理任务在进行中' };
        }
        
        try {
            this.isProcessing = true;
            this.settings = settings;
            this.processedCount = 0;
            
            // 准备处理队列
            this.prepareProcessQueue(images, prompts);
            
            console.log(`开始批量处理，共 ${this.processQueue.length} 个任务`);
            
            // 开始处理
            await this.processAllTasks();
            
            return { 
                success: true, 
                message: `成功处理 ${this.processedCount} 个视频任务` 
            };
            
        } catch (error) {
            console.error('批量处理出错:', error);
            return { success: false, error: error.message };
        } finally {
            this.isProcessing = false;
        }
    }
    
    prepareProcessQueue(images, prompts) {
        this.processQueue = [];
        const maxTasks = Math.min(images.length, prompts.length);
        
        for (let i = 0; i < maxTasks; i++) {
            this.processQueue.push({
                image: images[i],
                prompt: prompts[i],
                index: i + 1
            });
        }
        
        this.totalTasks = maxTasks;
    }
    
    async processAllTasks() {
        for (let i = 0; i < this.processQueue.length; i++) {
            const task = this.processQueue[i];
            
            console.log(`处理任务 ${task.index}/${this.totalTasks}: ${task.image.name}`);
            
            try {
                if (this.settings.processMode === 'smart') {
                    await this.processSingleTaskWithSmartDetection(task);
                } else {
                    await this.processSingleTask(task);
                }
                
                this.processedCount++;
                
                // 检查是否需要等待（排队模式）
                if (this.settings.processMode === 'queue' && 
                    this.processedCount % this.settings.batchSize === 0 && 
                    i < this.processQueue.length - 1) {
                    
                    const waitTime = this.settings.waitTime * 60 * 1000; // 转换为毫秒
                    console.log(`已处理 ${this.processedCount} 个任务，等待 ${this.settings.waitTime} 分钟...`);
                    await this.sleep(waitTime);
                }
                
            } catch (error) {
                console.error(`处理任务 ${task.index} 失败:`, error);
                // 继续处理下一个任务
            }
            
            // 添加任务间隔，避免请求过快
            await this.sleep(2000);
        }
    }
    
    async processSingleTask(task) {
        if (this.pageType === 'reference') {
            await this.processReferenceTask(task);
        } else if (this.pageType === 'text2video') {
            await this.processText2VideoTask(task);
        } else {
            await this.processImg2VideoTask(task);
        }
    }
    
    async processImg2VideoTask(task) {
        // 1. 上传图片
        await this.uploadImage(task.image);
        
        // 2. 输入Prompt
        await this.inputPrompt(task.prompt);
        
        // 3. 使用智能检测点击创作按钮，避免网络卡顿导致误提交
        await this.clickCreateButtonWithSmartDetection(task.image);
        
        // 4. 确认已提交（短轮询）
        await this.waitForSubmissionStart(task.image);
        
        // 5. 点击垃圾桶按钮清空内容，为下一个任务准备
        await this.clickClearButton();
        await this.waitForPageReset();
    }
    
    async processReferenceTask(task) {
        // 1. 切换到参考生视频标签页
        await this.switchToReferenceTab();
        
        // 2. 点击主体库按钮选择参考主体
        await this.clickSubjectLibraryButton();
        
        // 3. 输入Prompt
        await this.inputPrompt(task.prompt);
        
        // 4. 启用错峰模式
        await this.enableOffPeakMode();
        
        // 5. 使用智能检测点击创作按钮
        await this.clickCreateButtonWithSmartDetection();
        
        // 6. 确认已提交
        await this.waitForSubmissionStart();
        
        // 7. 清空内容，为下一个任务准备
        await this.clickClearButton();
        await this.waitForPageReset();
    }
    
    async processText2VideoTask(task) {
        // 1. 切换到文生视频标签页
        await this.switchToText2VideoTab();
        
        // 2. 配置视频设置
        await this.configureVideoSettings();
        
        // 3. 输入Prompt
        await this.inputPrompt(task.prompt);
        
        // 4. 使用智能检测点击创作按钮
        await this.clickCreateButtonWithSmartDetection();
        
        // 5. 确认已提交
        await this.waitForSubmissionStart();
        
        // 6. 清空内容，为下一个任务准备
        await this.clickClearButton();
        await this.waitForPageReset();
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
            this.dbg('uploadImage[setFile]', { name: imageFile.name, inputRect: this.rectOf(fileInput) });
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

        if (!applied && zone) {
            try {
                const dt2 = new DataTransfer();
                dt2.items.add(imageFile);
                const fire = (type) => {
                    try {
                        const e = new DragEvent(type, { bubbles: true, cancelable: true });
                        try { Object.defineProperty(e, 'dataTransfer', { value: dt2 }); } catch (_) {}
                        zone.dispatchEvent(e);
                    } catch (_) {}
                };
                try { zone.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
                fire('dragenter');
                fire('dragover');
                fire('drop');
                this.dbg('uploadImage[drop]', { name: imageFile.name, zone: this.rectOf(zone) });
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
        }

        if (!applied) throw new Error('图片上传失败');
        await this.sleep(800);
        console.log(`图片 ${imageFile.name} 上传完成`);
    }
    
    async inputPrompt(promptText) {
        const el = await this.waitForPromptInput(15000);
        if (!el) {
            throw new Error('未找到Prompt输入框');
        }
        const safeText = (typeof promptText === 'string' && promptText.length > 0) ? promptText : ' ';
        this.lastPrompt = safeText;
        if (el.tagName && (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input')) {
            el.value = '';
            el.focus();
            this.simulateTyping(el, safeText);
        } else {
            el.focus();
            el.textContent = '';
            el.textContent = safeText;
            const inputEvent = new Event('input', { bubbles: true });
            el.dispatchEvent(inputEvent);
            const changeEvent = new Event('change', { bubbles: true });
            el.dispatchEvent(changeEvent);
        }
        await this.sleep(500);
        console.log(`Prompt输入完成: ${this.lastPrompt.substring(0, 50)}...`);
    }
    
    simulateTyping(element, text) {
        element.value = text;
        
        // 触发输入事件
        const inputEvent = new Event('input', { bubbles: true });
        element.dispatchEvent(inputEvent);
        
        // 触发change事件
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);
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
    
    async processSingleTaskWithSmartDetection(task) {
        // 1. 上传图片
        await this.uploadImage(task.image);
        
        // 2. 输入Prompt
        await this.inputPrompt(task.prompt);
        
        // 3. 智能检测并点击创作按钮
        await this.clickCreateButtonWithSmartDetection(task.image);
        
        // 4. 确认已提交（短轮询）
        await this.waitForSubmissionStart(task.image);
        
        // 5. 点击垃圾桶按钮清空内容，为下一个任务准备
        await this.clickClearButton();
        await this.waitForPageReset();
    }
    
    async clickCreateButtonWithSmartDetection(expectedImageFile) {
        const maxRetries = this.settings.maxRetries || 5;
        const checkInterval = (this.settings.checkInterval || 8) * 1000; // 转换为毫秒
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`智能检测模式 - 尝试 ${attempt}/${maxRetries}`);
            
            // 等待按钮状态更新
            await this.sleep(2000);
            
            const createButton = this.findCreateButton();
            const promptEl = this.queryPromptInputElement();
            const promptValue = promptEl ? (promptEl.tagName ? promptEl.value : (promptEl.textContent || '')) : '';
            const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
            const promptOk = promptEl ? (norm(promptValue) === norm(this.lastPrompt)) : true;
            
            // 检查图像就绪：锁定首帧文件输入，其次预览图存在
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
            
            const clickable = createButton ? this.resolveClickableNode(createButton) : null;
            const canClick = clickable && (this.isButtonClickable(clickable) || relax);
            if (clickable && canClick && promptOk && (imageOk || relax)) {
                try { clickable.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
                this.attemptClick(clickable);
                console.log(`智能检测成功 - 第 ${attempt} 次尝试点击创作按钮`);
                return;
            } else {
                console.log(`智能检测 - 第 ${attempt} 次尝试，按钮不可用或未就绪(promptOk=${promptOk}, imageOk=${imageOk})，等待 ${this.settings.checkInterval} 秒后重试...`);
                
                if (attempt < maxRetries) {
                    await this.sleep(checkInterval);
                }
            }
        }
        
        throw new Error(`智能检测模式失败 - 尝试 ${maxRetries} 次后创作按钮仍不可用`);
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
    
    dbg(tag, data) {
        try { console.log('[VIDU-DBG]', tag, data !== undefined ? data : ''); } catch (_) {}
    }
    rectOf(el) {
        try { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; } catch (_) { return null; }
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
            if (
                text.includes('创作') || aria.includes('创作') ||
                text.includes('开始创作') || aria.includes('开始创作') ||
                text.toLowerCase().includes('create') || aria.toLowerCase().includes('create') ||
                text.includes('生成') || aria.includes('生成') ||
                text.toLowerCase().includes('generate') || aria.toLowerCase().includes('generate')
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

    async waitForElementInZone(selectors, zone, timeoutMs = 2000) {
        try {
            const findNow = () => {
                const list = this.deepQuerySelectorAll(selectors, zone)
                    .filter(n => !this.isInsideOurUI(n))
                    .filter(n => this.isElementVisible(n));
                return list[0] || null;
            };
            let found = findNow();
            if (found) return found;
            return await new Promise((resolve) => {
                let done = false;
                const obs = new MutationObserver(() => {
                    if (done) return;
                    const n = findNow();
                    if (n) { done = true; try { obs.disconnect(); } catch (_) {}; resolve(n); }
                });
                try { obs.observe(zone || document.body, { childList: true, subtree: true }); } catch (_) {}
                setTimeout(() => { if (!done) { done = true; try { obs.disconnect(); } catch (_) {}; resolve(null); } }, timeoutMs);
            });
        } catch (_) { return null; }
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
            return !!(el.closest && (el.closest('.vidu-floating-panel') || el.closest('.vidu-floating-ball')));
        } catch (_) {
            return false;
        }
    }

    isTailFrameContainer(el) {
        try {
            let cur = el;
            for (let i = 0; i < 6 && cur; i++) {
                const text = (cur.textContent || '').replace(/\s+/g, '');
                const low = text.toLowerCase();
                if (text.includes('尾帧') || low.includes('tail')) return true;
                cur = cur.parentElement || cur.parentNode;
            }
        } catch (_) {}
        return false;
    }

    chooseFirstFrameFileInput() {
        const zone = this.findFirstFrameZone();
        // 1) 区域内查找（包含隐藏input，排除悬浮UI）
        if (zone) {
            let searchRoot = zone;
            for (let depth = 0; depth < 6 && searchRoot; depth++) {
                const zoned = this.deepQuerySelectorAll([
                    'input[type="file"][accept*="image"]',
                    'input[type="file"]'
                ], searchRoot).filter(el => !this.isInsideOurUI(el));
                if (zoned.length > 0) {
                    const chosen = zoned[0];
                    this.dbg('chooseFirstFrameFileInput[zone]', { count: zoned.length, chosen: this.rectOf(chosen) });
                    return chosen;
                }
                searchRoot = searchRoot.parentElement || searchRoot.parentNode;
            }
        }
        // 2) 全局最近原则（包含隐藏input，排除悬浮UI）
        const inputs = this.deepQuerySelectorAll([
            'input[type="file"][accept*="image"]',
            'input[type="file"]'
        ]).filter(el => !this.isInsideOurUI(el));
        if (inputs.length === 0) return null;
        const inputsNoTail = inputs.filter(el => !this.isTailFrameContainer(el));
        const arr = inputsNoTail.length > 0 ? inputsNoTail : inputs;
        if (zone) {
            try {
                const zr = zone.getBoundingClientRect();
                const zx = zr.left + zr.width / 2;
                const zy = zr.top + zr.height / 2;
                arr.sort((a, b) => {
                    const ra = a.getBoundingClientRect();
                    const rb = b.getBoundingClientRect();
                    const da = Math.abs((ra.left + ra.width / 2) - zx) + Math.abs((ra.top + ra.height / 2) - zy);
                    const db = Math.abs((rb.left + rb.width / 2) - zx) + Math.abs((rb.top + rb.height / 2) - zy);
                    return da - db;
                });
            } catch (_) {}
        } else {
            arr.sort((a, b) => {
                const ra = a.getBoundingClientRect();
                const rb = b.getBoundingClientRect();
                if (ra.left !== rb.left) return ra.left - rb.left;
                return ra.top - rb.top;
            });
        }
        const chosenGlobal = arr[0] || null;
        this.dbg('chooseFirstFrameFileInput[global]', { count: inputs.length, noTail: inputsNoTail.length, chosen: this.rectOf(chosenGlobal) });
        return chosenGlobal;
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
        // 0) 基于隐藏的 file input 精准定位（优先）
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
                if (c && this.isElementVisible(c)) {
                    const r = c.getBoundingClientRect();
                    // 强制过滤：必须是大尺寸容器，排除小图标
                    if (r.width >= 200 && r.height >= 100 && r.top > 80) {
                        containers.push(c);
                    }
                }
            }
            const nonTail = containers.filter(c => !this.isTailFrameContainer(c));
            const pick = nonTail.length > 0 ? nonTail : containers;
            if (pick.length > 0) {
                pick.sort((a, b) => {
                    const ra = a.getBoundingClientRect();
                    const rb = b.getBoundingClientRect();
                    if (ra.left !== rb.left) return ra.left - rb.left;
                    return ra.top - rb.top;
                });
                const chosen = pick[0];
                this.dbg('findFirstFrameZone[input]', { inputs: inputCandidates.length, nonTail: nonTail.length, chosen: this.rectOf(chosen) });
                return chosen;
            }
        } catch (_) {}

        // 0.5) 大尺寸卡片候选（左卡优先，过滤顶部导航等小图标）
        try {
            const tiles = this.deepQuerySelectorAll([
                '.inline-flex.cursor-pointer',
                '.rounded-10',
                'div[role="button"]',
                'div[class*="cursor-pointer"]'
            ]).filter(el => this.isElementVisible(el) && !this.isInsideOurUI(el));
            const bigs = tiles.filter(el => {
                try {
                    const r = el.getBoundingClientRect();
                    const area = r.width * r.height;
                    // 更严格的尺寸要求：必须是真正的大卡片
                    return r.top > 120 && r.left < window.innerWidth * 0.7 && r.width >= 300 && r.height >= 120 && area >= 36000;
                } catch (_) { return false; }
            }).filter(c => !this.isTailFrameContainer(c));
            if (bigs.length > 0) {
                bigs.sort((a, b) => {
                    const ra = a.getBoundingClientRect();
                    const rb = b.getBoundingClientRect();
                    if (ra.left !== rb.left) return ra.left - rb.left; // 左侧优先
                    return ra.top - rb.top;
                });
                const chosen = bigs[0];
                this.dbg('findFirstFrameZone[tile]', { count: bigs.length, chosen: this.rectOf(chosen) });
                return chosen;
            }
        } catch (_) {}

        // 1) 文本/结构启发式（原逻辑）
        const pool = this.deepQuerySelectorAll([
            'div', 'button', 'label', 'span', 'section'
        ]).filter(el => this.isElementVisible(el));
        const hasText = (el) => ((el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim());
        const primary = pool.filter(n => hasText(n).includes('首帧'));
        const pickContainer = (node) => {
            let cur = node;
            for (let i = 0; i < 6 && cur; i++) {
                try {
                    const t = hasText(cur);
                    const cls = (cur.className || '').toString();
                    const style = window.getComputedStyle(cur);
                    const rect = cur.getBoundingClientRect();
                    const bigEnough = rect.width >= 80 && rect.height >= 60;
                    const looksTile = /inline-flex|flex|grid|card|pane|panel/i.test(cls) || t.includes('+');
                    const clickable = (style.cursor === 'pointer') || cur.getAttribute('role') === 'button';
                    if (bigEnough && (looksTile || clickable)) return cur;
                } catch (_) {}
                cur = cur.parentElement || cur.parentNode;
            }
            return null; // 不再回退到原小节点，避免选到 40x40 的图标
        };
        const containers2 = (primary.length > 0 ? primary : pool.filter(n => /\+|上传|选择|add|upload/i.test(hasText(n))))
            .map(pickContainer)
            .filter(c => c)
            .filter(c => !this.isTailFrameContainer(c))
            .filter(c => { try { const r = c.getBoundingClientRect(); return r.top > 90 && r.width >= 120 && r.height >= 80; } catch (_) { return false; } });
        if (containers2.length === 0) return null;
        containers2.sort((a, b) => {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            if (ra.left !== rb.left) return ra.left - rb.left;
            return ra.top - rb.top;
        });
        const chosenFb = containers2[0] || null;
        this.dbg('findFirstFrameZone[fallback]', { count: containers2.length, chosen: this.rectOf(chosenFb) });
        return chosenFb;
    }

    findTailFrameZone() {
        try {
            const pool = this.deepQuerySelectorAll(['div','section','button','label','span']).filter(el => this.isElementVisible(el));
            const textOf = (el) => ((el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim());
            const hits = pool.filter(n => /尾帧|tail/i.test(textOf(n)));
            if (hits.length === 0) return null;
            const pickContainer = (node) => {
                let cur = node;
                for (let i = 0; i < 6 && cur; i++) {
                    try {
                        const t = textOf(cur);
                        const cls = (cur.className || '').toString();
                        const style = window.getComputedStyle(cur);
                        const rect = cur.getBoundingClientRect();
                        const bigEnough = rect.width >= 80 && rect.height >= 60;
                        const looksTile = /inline-flex|flex|grid|card|pane|panel/i.test(cls) || t.includes('+');
                        const clickable = (style.cursor === 'pointer') || cur.getAttribute('role') === 'button';
                        if (bigEnough && (looksTile || clickable)) return cur;
                    } catch (_) {}
                    cur = cur.parentElement || cur.parentNode;
                }
                return node;
            };
            const containers = hits.map(pickContainer).filter(c => this.isElementVisible(c));
            containers.sort((a, b) => {
                const ra = a.getBoundingClientRect();
                const rb = b.getBoundingClientRect();
                if (ra.left !== rb.left) return ra.left - rb.left;
                return ra.top - rb.top;
            });
            const chosen = containers[0] || null;
            this.dbg('findTailFrameZone', { count: containers.length, chosen: this.rectOf(chosen) });
            return chosen;
        } catch (_) { return null; }
    }
    
    isFirstFrameZoneEmpty() {
        const zone = this.findFirstFrameZone();
        if (!zone) return false;
        const imgs = this.deepQuerySelectorAll([
            'img[src^="blob:"]',
            'img[src^="data:"]',
            '[class*="preview"] img',
            '[class*="thumb"] img'
        ], zone);
        if (imgs.length > 0) return false;
        const inputs = this.deepQuerySelectorAll([
            'input[type="file"][accept*="image"]',
            'input[type="file"]'
        ], zone);
        if (inputs.length > 0 && inputs[0].files && inputs[0].files.length > 0) return false;
        return true;
    }

    collectSnapshot() {
        try {
            const first = this.findFirstFrameZone();
            const tail  = this.findTailFrameZone();
            const inputs = this.deepQuerySelectorAll([
                'input[type="file"][accept*="image"]',
                'input[type="file"]'
            ]);
            const list = inputs.map((el, i) => ({
                i,
                rect: this.rectOf(el),
                visible: this.isElementVisible(el),
                isTail: this.isTailFrameContainer(el)
            }));
            const chosen = this.chooseFirstFrameFileInput();
            return {
                firstRect: this.rectOf(first),
                tailRect:  this.rectOf(tail),
                fileInputs: list,
                chosenFileInput: this.rectOf(chosen)
            };
        } catch (e) {
            return { error: String(e && e.message || e) };
        }
    }
    
    async waitForSubmissionStart(expectedImageFile) {
        const pollMs = 1000;
        const maxLoops = Math.max(12, (this.settings.maxRetries || 5) * 3);
        const minWaitMs = Math.max(2500, Number(this.settings.postClickMinWaitMs) || 4000);
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
            const btn = this.findCreateButton();
            let disabledNow = false;
            if (btn) {
                const ariaDisabled = btn.getAttribute && btn.getAttribute('aria-disabled') === 'true';
                disabledNow = (('disabled' in btn) && btn.disabled) || ariaDisabled;
            }
            if (disabledNow) seenDisabledOnce = true;
            const btnBusy = this.isCreateButtonBusy();
            busyStreak = btnBusy ? (busyStreak + 1) : 0;

            const combinedOk = (zoneEmptyStreak >= 3 || inputChangedStreak >= 3) && (busyStreak >= 3) && seenDisabledOnce;
            if ((hints.length > 0 || combinedOk) && (Date.now() - t0) >= minWaitMs) return;
            await this.sleep(pollMs);
        }
    }
    
    async waitForResponse() {
        // 等待页面响应，可以根据实际情况调整
        await this.sleep(3000);
        
        // 检查是否有错误提示
        const errorElement = document.querySelector('[class*="error"], [class*="Error"], .error-message');
        if (errorElement && errorElement.textContent.trim()) {
            throw new Error(`创作失败: ${errorElement.textContent}`);
        }
        
        console.log('任务提交成功，等待下一个任务');
    }
    
    async clickClearButton() {
        this.dbg('clickClearButton:start', '开始查找并点击清空按钮');
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

        // 0) 首帧区内优先：XPath + CSS（优先命中卡片右下角垃圾桶）
        try {
            const zone = this.findFirstFrameZone();
            this.dbg('clickClearButton:zone', { zoneFound: !!zone, zoneRect: this.rectOf(zone) });
            if (zone) {
                // 验证zone是否为有效的大容器，拒绝小图标
                const zr = zone.getBoundingClientRect();
                if (zr.width < 200 || zr.height < 100) {
                    this.dbg('clickClearButton:zone-rejected', { reason: 'zone too small', zoneRect: this.rectOf(zone) });
                    // 跳过这个无效的zone
                } else {
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
                this.dbg('clickClearButton:candidates', { xpathCount: xres.snapshotLength, cssCount: cssAdds.length, totalCandidates: candidates.length });
                if (candidates.length > 0) {
                    const zr = zone.getBoundingClientRect();
                    const zx = zr.left + zr.width;  // 右边
                    const zy = zr.top + zr.height;  // 下边
                    candidates.sort((a, b) => {
                        const ra = a.getBoundingClientRect();
                        const rb = b.getBoundingClientRect();
                        const ca = Math.abs((ra.left + ra.width/2) - zx) + Math.abs((ra.top + ra.height/2) - zy);
                        const cb = Math.abs((rb.left + rb.width/2) - zx) + Math.abs((rb.top + rb.height/2) - zy);
                        return ca - cb; // 更靠右下优先
                    });
                    clearButton = candidates[0] || null;
                    if (clearButton) this.dbg('clearButton[zone-svg]', { rect: this.rectOf(clearButton) });
                }
                if (!clearButton) {
                    this.dbg('clickClearButton:waiting', '在首帧区域内等待垃圾桶按钮出现');
                    const waited = await this.waitForElementInZone([
                        'svg.cursor-pointer',
                        'svg.cursor-pointer.text-base',
                        'svg[width="1em"][height="1em"].cursor-pointer',
                        '[aria-label*="删除"]', '[aria-label*="清空"]', '[title*="删除"]', '[title*="清空"]'
                    ], zone, 1800);
                    if (waited) { clearButton = this.resolveClickableNode(waited); this.dbg('clearButton[zone-wait]', { rect: this.rectOf(clearButton) }); }
                }
                }
            }
        } catch (_) {}

        // 1) XPath 优先逻辑
        if (!clearButton) try {
            const xres = document.evaluate('//*[local-name()="svg"][contains(@class, "cursor-pointer")]', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            const candidates = [];
            for (let i = 0; i < xres.snapshotLength; i++) {
                const n = xres.snapshotItem(i);
                if (!this.isInsideOurUI(n) && this.isElementVisible(n)) {
                    candidates.push(this.resolveClickableNode(n));
                }
            }
            const anchorA = this.queryPromptInputElement();
            const anchorB = this.findFirstFrameZone();
            let ax = window.innerWidth, ay = window.innerHeight;
            try {
                const ar = (anchorA || anchorB) ? (anchorA || anchorB).getBoundingClientRect() : null;
                if (ar) { ax = ar.right; ay = ar.bottom; }
            } catch (_) {}
            candidates.sort((a, b) => {
                const ra = a.getBoundingClientRect();
                const rb = b.getBoundingClientRect();
                const da = Math.hypot((ra.left + ra.width/2) - ax, (ra.top + ra.height/2) - ay);
                const db = Math.hypot((rb.left + rb.width/2) - ax, (rb.top + rb.height/2) - ay);
                return da - db;
            });
            clearButton = candidates[0] || null;
            if (clearButton) this.dbg('clearButton[xpath]', { rect: this.rectOf(clearButton) });
        } catch (_) {}

        // 2) 在提示词区域附近查找
        if (!clearButton) {
            try {
                const promptEl = this.queryPromptInputElement();
                if (promptEl) {
                    let root = promptEl;
                    for (let depth = 0; depth < 6 && root; depth++) {
                        root = root.parentElement || root.parentNode;
                        if (!root || !root.querySelectorAll) continue;
                        const near = this.deepQuerySelectorAll(preferSelectors, root)
                            .filter(n => !this.isInsideOurUI(n))
                            .map(n => this.resolveClickableNode(n))
                            .filter(n => this.isElementVisible(n));
                        if (near.length > 0) {
                            near.sort((a, b) => {
                                const ra = a.getBoundingClientRect();
                                const rb = b.getBoundingClientRect();
                                const scoreA = (window.innerWidth - ra.right) + ra.top;
                                const scoreB = (window.innerWidth - rb.right) + rb.top;
                                return scoreA - scoreB;
                            });
                            clearButton = near[0];
                            this.dbg('clearButton[prompt-near]', { rect: this.rectOf(clearButton) });
                            break;
                        }
                    }
                }
            } catch (_) {}
        }

        // 3) 回退：预览区域右上角的关闭(X)
        if (!clearButton) {
            try {
                const zone = this.findFirstFrameZone();
                if (zone) {
                    const xSelectors = [
                        'button',
                        'svg',
                        '[class*="close"]',
                        '[class*="trash"]',
                        '[class*="delete"]'
                    ];
                    const candidates = this.deepQuerySelectorAll(xSelectors, zone)
                        .filter(n => !this.isInsideOurUI(n))
                        .map(n => this.resolveClickableNode(n))
                        .filter(n => this.isElementVisible(n));
                    candidates.sort((a, b) => {
                        const ra = a.getBoundingClientRect();
                        const rb = b.getBoundingClientRect();
                        const scoreA = (window.innerWidth - ra.right) + ra.top;
                        const scoreB = (window.innerWidth - rb.right) + rb.top;
                        return scoreA - scoreB; // 更靠右上优先
                    });
                    clearButton = candidates[0] || null;
                    if (clearButton) this.dbg('clearButton[zone-fallback]', { rect: this.rectOf(clearButton) });
                }
            } catch (_) {}
        }

        // 4) 兜底：全局搜索
        if (!clearButton) {
            try {
                clearButton = this.deepQuerySelectorAll([
                    'svg.cursor-pointer',
                    'svg.cursor-pointer.text-base',
                    'svg[class*="cursor-pointer"]',
                    '[class*="trash"]',
                    '[class*="delete"]',
                    '[class*="clear"]',
                    '[aria-label*="删除"]',
                    '[aria-label*="清空"]',
                    '[title*="删除"]',
                    '[title*="清空"]'
                ]).filter(n => !this.isInsideOurUI(n)).map(n => this.resolveClickableNode(n)).find(n => this.isElementVisible(n)) || null;
                if (clearButton) this.dbg('clearButton[global-fallback]', { rect: this.rectOf(clearButton) });
            } catch (_) {}
        }

        if (clearButton) {
            const buttonRect = this.rectOf(clearButton);
            this.dbg('clickClearButton:found', { buttonRect, buttonTag: clearButton.tagName, buttonClass: clearButton.className });
            
            // 验证按钮尺寸，拒绝过小的按钮（可能是错误的小图标）
            if (buttonRect && (buttonRect.w < 20 || buttonRect.h < 20)) {
                this.dbg('clickClearButton:button-rejected', { reason: 'button too small', buttonRect });
                clearButton = null;
            } else {
                // 禁用滚动，避免影响页面布局
                // try { clearButton.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
                this.attemptClick(clearButton);
            this.dbg('clickClearButton:clicked', '已执行点击操作');
            await this.sleep(800);
            // 点击后再次校验，若未清空则再试1~2次
            for (let i = 0; i < 2; i++) {
                const isEmpty = this.isFirstFrameZoneEmpty();
                this.dbg('clickClearButton:verify', { attempt: i + 1, isEmpty });
                if (isEmpty) break;
                try { this.attemptClick(clearButton); } catch (_) {}
                await this.sleep(500);
            }
                this.dbg('clickClearButton:end', '清空按钮处理完成');
            }
        }
        
        if (!clearButton) {
            this.dbg('clickClearButton:notfound', '未找到清空按钮，跳过清空步骤');
            await this.sleep(500);
        }
    }

    async waitForPageReset() {
        // 主动清空重试版，确保下一轮首帧为空
        const maxWait = 12000;
        const start = Date.now();
        let attempts = 0;
        while (Date.now() - start < maxWait) {
            const zoneEmpty = this.isFirstFrameZoneEmpty();
            const promptEl = this.queryPromptInputElement();
            const promptEmpty = !promptEl || (promptEl.tagName ? !promptEl.value || promptEl.value.trim() === '' : !promptEl.textContent || promptEl.textContent.trim() === '');
            if (zoneEmpty && promptEmpty) { this.dbg('waitForPageReset:reset'); return; }

            attempts++;
            if (attempts === 4 || attempts === 8) {
                try { await this.clickClearButton(); } catch (_) {}
                // 清空提示词
                try {
                    const el = this.queryPromptInputElement();
                    if (el) {
                        if (el.tagName && (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input')) el.value = '';
                        else el.textContent = '';
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } catch (_) {}
                // 清空 file input
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
        this.dbg('waitForPageReset:timeout');
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
    
    // 文生视频页面专用方法
    async switchToText2VideoTab() {
        if (this.pageType !== 'text2video') {
            console.log('当前页面不是文生视频页面，无需切换标签');
            return;
        }
        
        // 查找并点击"文生视频"标签
        const text2videoTab = this.findText2VideoTab();
        if (text2videoTab) {
            this.attemptClick(text2videoTab);
            await this.sleep(1000);
            console.log('已切换到文生视频标签');
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
    
    findText2VideoTab() {
        const tabs = this.deepQuerySelectorAll([
            'button[aria-selected]',
            'button[role="tab"]',
            'div[role="tab"]'
        ]);
        
        for (const tab of tabs) {
            const text = (tab.textContent || tab.innerText || '').trim();
            if (text.includes('文生视频') || text.includes('文生')) {
                return tab;
            }
        }
        return null;
    }
    
    async clickSubjectLibraryButton() {
        const subjectLibraryBtn = this.findSubjectLibraryButton();
        if (subjectLibraryBtn) {
            this.attemptClick(subjectLibraryBtn);
            await this.sleep(2000);
            console.log('已点击主体库按钮');
        } else {
            console.log('未找到主体库按钮');
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
        const offPeakToggle = this.findOffPeakToggle();
        if (offPeakToggle) {
            const isEnabled = offPeakToggle.getAttribute('aria-checked') === 'true' || 
                             offPeakToggle.getAttribute('data-state') === 'checked';
            
            if (!isEnabled) {
                this.attemptClick(offPeakToggle);
                await this.sleep(500);
                console.log('已启用错峰模式');
            } else {
                console.log('错峰模式已启用');
            }
        } else {
            console.log('未找到错峰模式开关');
        }
    }
    
    async configureVideoSettings() {
        // 配置视频设置
        if (this.settings.videoSettings) {
            const { duration, aspectRatio, quantity, offPeakMode } = this.settings.videoSettings;
            
            // 设置时长
            if (duration) {
                await this.setVideoDuration(duration);
            }
            
            // 设置宽高比
            if (aspectRatio) {
                await this.setVideoAspectRatio(aspectRatio);
            }
            
            // 设置数量
            if (quantity) {
                await this.setVideoQuantity(quantity);
            }
            
            // 设置错峰模式
            if (offPeakMode) {
                await this.enableOffPeakMode();
            }
        } else {
            // 如果没有videoSettings，使用主设置
            if (this.settings.videoDuration) {
                await this.setVideoDuration(this.settings.videoDuration);
            }
            
            if (this.settings.aspectRatio) {
                await this.setVideoAspectRatio(this.settings.aspectRatio);
            }
            
            if (this.settings.generationCount) {
                await this.setVideoQuantity(this.settings.generationCount);
            }
            
            if (this.settings.offPeakMode) {
                await this.enableOffPeakMode();
            }
        }
    }
    
    findOffPeakToggle() {
        const toggles = this.deepQuerySelectorAll([
            'button[role="switch"]',
            'input[type="checkbox"]',
            '[role="switch"]'
        ]);
        
        for (const toggle of toggles) {
            const parent = toggle.parentElement || toggle.closest('div');
            if (parent) {
                const text = (parent.textContent || parent.innerText || '').trim();
                if (text.includes('错峰') || text.includes('错峰模式')) {
                    return toggle;
                }
            }
        }
        return null;
    }
    
    async setVideoDuration(duration) {
        const durationButton = this.findVideoDurationButton(duration);
        if (durationButton) {
            // 检查是否已经选中
            const isSelected = durationButton.getAttribute('data-state') === 'on' || 
                              durationButton.getAttribute('aria-checked') === 'true';
            if (!isSelected) {
                this.attemptClick(durationButton);
                await this.sleep(500);
                console.log(`已设置视频时长为 ${duration} 秒`);
            } else {
                console.log(`视频时长已经是 ${duration} 秒`);
            }
        } else {
            console.log(`未找到时长 ${duration} 秒的按钮`);
        }
    }
    
    findVideoDurationButton(duration) {
        // 查找时长按钮组
        const durationButtons = this.deepQuerySelectorAll([
            'button[role="radio"]',
            'button[data-radix-collection-item]'
        ]);
        
        for (const button of durationButtons) {
            const buttonText = (button.textContent || button.innerText || '').trim();
            const parent = button.parentElement || button.closest('div');
            if (parent) {
                const parentText = (parent.textContent || parent.innerText || '').trim();
                // 检查是否在时长区域
                if (parentText.includes('时长') || parentText.includes('秒')) {
                    // 检查按钮文本是否匹配
                    if (buttonText === duration.toString() || 
                        buttonText === duration + 's' || 
                        buttonText === duration + '秒') {
                        return button;
                    }
                }
            }
        }
        return null;
    }
    
    async setVideoAspectRatio(aspectRatio) {
        const aspectRatioButton = this.findVideoAspectRatioButton();
        if (aspectRatioButton) {
            // 点击打开下拉菜单
            this.attemptClick(aspectRatioButton);
            await this.sleep(1000);
            
            // 查找并点击对应的选项
            const option = this.findAspectRatioOption(aspectRatio);
            if (option) {
                this.attemptClick(option);
                await this.sleep(500);
                console.log(`已设置视频宽高比为 ${aspectRatio}`);
            } else {
                console.log(`未找到宽高比选项 ${aspectRatio}`);
            }
        } else {
            console.log('未找到宽高比选择器');
        }
    }
    
    findVideoAspectRatioButton() {
        const buttons = this.deepQuerySelectorAll([
            'button[role="combobox"]'
        ]);
        
        for (const button of buttons) {
            const parent = button.parentElement || button.closest('div');
            if (parent) {
                const text = (parent.textContent || parent.innerText || '').trim();
                if (text.includes('宽高比') || text.includes('比例')) {
                    return button;
                }
            }
        }
        return null;
    }
    
    findAspectRatioOption(aspectRatio) {
        // 查找下拉菜单中的选项
        const options = this.deepQuerySelectorAll([
            'div[role="option"]',
            'button[role="option"]',
            'div[data-radix-collection-item]'
        ]);
        
        for (const option of options) {
            const text = (option.textContent || option.innerText || '').trim();
            if (text.includes(aspectRatio)) {
                return option;
            }
        }
        return null;
    }
    
    async setVideoQuantity(quantity) {
        const quantityButton = this.findVideoQuantityButton(quantity);
        if (quantityButton) {
            // 检查是否已经选中
            const isSelected = quantityButton.getAttribute('data-state') === 'on' || 
                              quantityButton.getAttribute('aria-checked') === 'true';
            if (!isSelected) {
                this.attemptClick(quantityButton);
                await this.sleep(500);
                console.log(`已设置视频数量为 ${quantity}`);
            } else {
                console.log(`视频数量已经是 ${quantity}`);
            }
        } else {
            console.log(`未找到数量 ${quantity} 的按钮`);
        }
    }
    
    findVideoQuantityButton(quantity) {
        // 查找数量按钮组
        const quantityButtons = this.deepQuerySelectorAll([
            'button[role="radio"]',
            'button[data-radix-collection-item]'
        ]);
        
        for (const button of quantityButtons) {
            const buttonText = (button.textContent || button.innerText || '').trim();
            const parent = button.parentElement || button.closest('div');
            if (parent) {
                const parentText = (parent.textContent || parent.innerText || '').trim();
                // 检查是否在数量区域
                if (parentText.includes('数量') || parentText.includes('个')) {
                    // 检查按钮文本是否匹配
                    if (buttonText === quantity.toString()) {
                        return button;
                    }
                }
            }
        }
        return null;
    }
    
    // 重写提示词输入方法以支持参考生视频页面
    async inputPrompt(promptText) {
        const el = await this.waitForPromptInput(15000);
        if (!el) {
            throw new Error('未找到Prompt输入框');
        }
        
        const safeText = (typeof promptText === 'string' && promptText.length > 0) ? promptText : ' ';
        this.lastPrompt = safeText;
        
        if (el.tagName && (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input')) {
            el.value = '';
            el.focus();
            this.simulateTyping(el, safeText);
        } else {
            el.focus();
            el.textContent = '';
            el.textContent = safeText;
            const inputEvent = new Event('input', { bubbles: true });
            el.dispatchEvent(inputEvent);
            const changeEvent = new Event('change', { bubbles: true });
            el.dispatchEvent(changeEvent);
        }
        await this.sleep(500);
        console.log(`Prompt输入完成: ${this.lastPrompt.substring(0, 50)}...`);
    }
    
    queryPromptInputElement() {
        const selectors = [
            'textarea[maxlength="1500"]',
            'textarea[required]',
            'textarea',
            '[contenteditable="true"]',
            '[role="textbox"]'
        ];
        const nodes = this.deepQuerySelectorAll(selectors).filter(n => !this.isInsideOurUI(n));
        return nodes[0] || null;
    }
    
    // 重写创作按钮查找方法
    findCreateButton() {
        const selectors = [
            'button',
            '[role="button"]'
        ];
        const nodes = this.deepQuerySelectorAll(selectors);
        for (const node of nodes) {
            const text = (node.textContent || node.innerText || '').trim();
            const aria = (node.getAttribute && (node.getAttribute('aria-label') || node.getAttribute('title'))) || '';
            if (
                text.includes('创作') || aria.includes('创作') ||
                text.includes('开始创作') || aria.includes('开始创作') ||
                text.toLowerCase().includes('create') || aria.toLowerCase().includes('create') ||
                text.includes('生成') || aria.includes('生成') ||
                text.toLowerCase().includes('generate') || aria.toLowerCase().includes('generate')
            ) {
                return node;
            }
        }
        return null;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 初始化控制器
const videuController = new VideuPageController();

// 调试桥：通过 window.postMessage 与页面控制台通信
try {
    window.addEventListener('message', (ev) => {
        try {
            const payload = ev && ev.data;
            if (!payload || !payload.__VIDU_DEBUG) return;
            if (payload.__VIDU_DEBUG === 'SNAPSHOT') {
                const data = videuController.collectSnapshot();
                window.postMessage({ __VIDU_DEBUG_RESULT: 'SNAPSHOT', data }, '*');
            }
        } catch (_) {}
    });
} catch (_) {}

// 页面加载完成后的额外初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Vidu页面已加载，批量处理功能已就绪');
    });
} else {
    console.log('Vidu页面已加载，批量处理功能已就绪');
}