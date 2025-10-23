// 后台服务脚本
chrome.runtime.onInstalled.addListener(() => {
    console.log('Vidu批量视频生成插件已安装');
});

// 处理来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'processFiles') {
        handleFileProcessing(request.data, sendResponse);
        return true; // 保持消息通道开放
    }
});

// 处理文件处理请求
async function handleFileProcessing(data, sendResponse) {
    try {
        const { images, prompts, settings } = data;
        
        // 获取当前活动标签页
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        const currentTab = tabs[0];
        
        if (!currentTab.url.includes('vidu.cn/create/')) {
            sendResponse({
                success: false,
                error: '请先打开Vidu的创建页面 (img2video 或 reference)'
            });
            return;
        }
        
        // 向content script发送处理请求
        chrome.tabs.sendMessage(currentTab.id, {
            action: 'startBatchProcess',
            images: images,
            prompts: prompts,
            settings: settings
        }, (response) => {
            sendResponse(response);
        });
        
    } catch (error) {
        console.error('处理文件时出错:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}