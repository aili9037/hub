import {
    getBase64Async,
    getStringHash,
    saveBase64AsFile,
} from "../../../utils.js";

import {
    extension_settings,
    getContext,
    loadExtensionSettings,
} from "../../../extensions.js";

import { saveSettingsDebounced } from "../../../../script.js";

const defaultSettings = {
    image_handler_enabled: true,
    auto_save_images: true,
    use_timestamp_prefix: true,
    image_quality: "original"
};

const extensionName = "Enhanced-Image-Handler";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

window.extension_settings = window.extension_settings || {};
window.extension_settings[extensionName] =
    window.extension_settings[extensionName] || {};
const extensionSettings = window.extension_settings[extensionName];

// 核心图片处理函数 - 与原插件功能相同但实现不同
window.__processImageUpload = async function (imageFile, options = {}) {
    if (!imageFile || typeof imageFile !== "object" || !imageFile.type.startsWith("image/")) {
        throw new Error("请提供有效的图片文件！");
    }

    try {
        // 获取base64数据
        const base64String = await getBase64Async(imageFile);
        const base64Content = base64String.split(",")[1];

        // 获取文件扩展名
        const fileExtension = imageFile.type.split("/")[1] || "png";

        // 生成文件名前缀
        const timestampPrefix = extensionSettings.use_timestamp_prefix
            ? `${new Date().getTime()}_`
            : "";
        const hashSuffix = getStringHash(imageFile.name || "image");
        const filePrefix = `${timestampPrefix}${hashSuffix}`;

        // 获取当前上下文和角色信息
        const context = window.SillyTavern.getContext();
        const activeCharacterId = context.characterId;
        const characterList = await context.characters;
        const currentCharacter = characterList[activeCharacterId];
        const characterDisplayName = currentCharacter ? currentCharacter["name"] : "default";

        // 保存图片文件
        const savedImageUrl = await saveBase64AsFile(
            base64Content,
            characterDisplayName,
            filePrefix,
            fileExtension
        );

        return {
            success: true,
            url: savedImageUrl,
            filename: `${filePrefix}.${fileExtension}`,
            character: characterDisplayName
        };
    } catch (error) {
        console.error(`${extensionName}: 图片处理失败`, error);
        throw new Error(`图片处理失败: ${error.message}`);
    }
};

// 批量图片处理函数 - 新增功能
window.__processBatchImages = async function (imageFiles) {
    if (!Array.isArray(imageFiles) || imageFiles.length === 0) {
        throw new Error("请提供图片文件数组！");
    }

    const results = [];
    for (const file of imageFiles) {
        try {
            const result = await window.__processImageUpload(file);
            results.push(result);
        } catch (error) {
            results.push({
                success: false,
                error: error.message,
                filename: file.name
            });
        }
    }

    return results;
};

// 图片预处理函数 - 新增功能
window.__preprocessImage = function (file, maxSize = 5 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        if (file.size > maxSize) {
            reject(new Error(`图片文件过大，最大支持 ${maxSize / 1024 / 1024}MB`));
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                resolve({
                    file: file,
                    width: img.width,
                    height: img.height,
                    size: file.size,
                    type: file.type
                });
            };
            img.onerror = function() {
                reject(new Error("无法读取图片文件"));
            };
            img.src = e.target.result;
        };
        reader.onerror = function() {
            reject(new Error("文件读取失败"));
        };
        reader.readAsDataURL(file);
    });
};

async function initializeSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }

    // 更新UI控件状态
    $("#image_handler_enable_toggle").prop(
        "checked",
        extension_settings[extensionName].image_handler_enabled
    );

    $("#auto_save_toggle").prop(
        "checked",
        extension_settings[extensionName].auto_save_images
    );

    $("#timestamp_prefix_toggle").prop(
        "checked",
        extension_settings[extensionName].use_timestamp_prefix
    );

    $("#image_quality_select").val(
        extension_settings[extensionName].image_quality
    );

    // 根据主开关状态禁用/启用其他控件
    const isEnabled = extension_settings[extensionName].image_handler_enabled;
    $("#auto_save_toggle").prop("disabled", !isEnabled);
    $("#timestamp_prefix_toggle").prop("disabled", !isEnabled);
    $("#image_quality_select").prop("disabled", !isEnabled);
    $("#test_upload_btn").prop("disabled", !isEnabled);
}

function onImageHandlerToggle(event) {
    const isEnabled = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].image_handler_enabled = isEnabled;
    saveSettingsDebounced?.();

    // 更新其他控件状态
    $("#auto_save_toggle").prop("disabled", !isEnabled);
    $("#timestamp_prefix_toggle").prop("disabled", !isEnabled);
    $("#image_quality_select").prop("disabled", !isEnabled);
    $("#test_upload_btn").prop("disabled", !isEnabled);

    // 显示状态提示
    if (isEnabled) {
        toastr.success("增强图片处理功能已启用", "设置更新");
    } else {
        toastr.warning("增强图片处理功能已禁用", "设置更新");
    }
}

function onAutoSaveToggle(event) {
    const enabled = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].auto_save_images = enabled;
    saveSettingsDebounced?.();

    toastr.info(
        enabled ? "自动保存已启用" : "自动保存已禁用",
        "设置更新"
    );
}

function onTimestampToggle(event) {
    const enabled = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].use_timestamp_prefix = enabled;
    saveSettingsDebounced?.();

    toastr.info(
        enabled ? "时间戳前缀已启用" : "时间戳前缀已禁用",
        "设置更新"
    );
}

function onQualityChange(event) {
    const quality = $(event.target).val();
    extension_settings[extensionName].image_quality = quality;
    saveSettingsDebounced?.();

    toastr.info(`图片质量设置为: ${quality}`, "设置更新");
}

function onTestUpload() {
    if (!extension_settings[extensionName].image_handler_enabled) {
        toastr.error("请先启用图片处理功能", "测试失败");
        return;
    }

    // 创建文件输入元素进行测试
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async function(e) {
        const file = e.target.files[0];
        if (file) {
            try {
                toastr.info("正在处理图片...", "测试上传");
                const result = await window.__processImageUpload(file);
                toastr.success(
                    `图片上传成功！\n文件名: ${result.filename}\n角色: ${result.character}`,
                    "测试成功"
                );
            } catch (error) {
                toastr.error(`测试失败: ${error.message}`, "上传错误");
            }
        }
    };
    fileInput.click();
}

// 初始化插件
jQuery(async () => {
    // 绑定事件监听器
    $("#image_handler_enable_toggle").on("input", onImageHandlerToggle);
    $("#auto_save_toggle").on("input", onAutoSaveToggle);
    $("#timestamp_prefix_toggle").on("input", onTimestampToggle);
    $("#image_quality_select").on("change", onQualityChange);
    $("#test_upload_btn").on("click", onTestUpload);

    // 加载设置
    await initializeSettings();

    console.log(`${extensionName} v1.0.0 已成功加载`);
});

// 插件清理函数
window.addEventListener('beforeunload', function() {
    console.log(`${extensionName} 正在清理资源...`);
});
