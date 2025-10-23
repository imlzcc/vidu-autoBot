# vidu谷歌浏览器插件

### 读取功能：
#### 读取本地指定文件夹内的图片和Prompt文档
1. 图片：支持jpg、png、webp格式
· 分镜判断：根据图片名判断分镜，例如 1、2、3...或者shot_1、shot_2...
2. Prompt文档：支持txt格式
· 一行一条图生视频Prompt，每个Prompt对应一个分镜图片
3. 支持选定文件夹路径
#### 排队等候功能
1. 一次提交4个视频后等候2分钟再进行提交
#### 支持批量脚本提交vidu

- 提交步骤：

1. 进入 https://www.vidu.cn/create/img2video
2. 点击首帧 > 选择图片提交
```html
<div class="inline-flex h-full w-full flex-col items-center justify-center rounded-10 cursor-pointer hover:bg-system-black64"><svg width="1em" height="1em" fill="none" viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg" class="flex-shrink-0 text-2xl text-system-white"><path d="M12.28 5.96875L12.2617 19.9688" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path><path d="M5.25 12.9688H19.25" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg><div class="mx-2 mt-2 text-center text-xs sm:mt-1.5">首帧</div><input hidden="" accept="image/jpeg,image/png,image/webp" multiple="" type="file"></div>
```

3. 点击输入框，输入提示词
```html
<textarea class="flex rounded-10 border border-input ring-offset-system-bg06 placeholder:text-system-text04 focus-visible:outline-none focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[calc(100%-24px)] w-full flex-1 resize-none rounded-none border-none bg-transparent p-0 text-sm text-system-white caret-system-blue02 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm lg:text-xs" maxlength="1500" required="">女孩开心地笑了</textarea>
```

4. 点击创作，完成一次视频创作
```html
<button class="inline-flex items-center justify-center whitespace-nowrap ring-offset-white transition-colors bg-ShengshuButton hover:bg-ShengshuButtonHover text-black font-semibold h-12 rounded-12 px-8 relative w-full overflow-hidden text-lg disabled:cursor-not-allowed"><div class="flex items-center justify-center"><span>创作</span><svg width="1em" height="1em" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="mr-1 ml-2 shrink-0 text-base"><path d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24ZM14.8571 9.14286C12.8929 7.17857 12 3.42857 12 3.42857C12 3.42857 11.1071 7.17857 9.14286 9.14286C7.17857 11.1071 3.42857 12 3.42857 12C3.42857 12 7.29018 13.0045 9.14286 14.8571C10.9955 16.7098 12 20.5714 12 20.5714C12 20.5714 12.7366 16.9777 14.8571 14.8571C16.9777 12.7366 20.5714 12 20.5714 12C20.5714 12 16.8214 11.1071 14.8571 9.14286Z" fill="currentColor" fill-rule="evenodd"></path></svg><span class="mr-1" style="color: inherit;">10</span></div></button>
```
