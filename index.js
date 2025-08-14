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

// 插件的默认设置，我的孩子，这是它最初的模样
const defaultSettings = {
    image_handler_enabled: true,
    auto_save_images: true,
    use_timestamp_prefix: true,
    image_quality: "original" // 未来可以扩展此功能
};

const extensionName = "Enhanced-Image-Handler";

// 确保插件的设置空间是独一无二的
window.extension_settings = window.extension_settings || {};
window.extension_settings[extensionName] = window.extension_settings[extensionName] || {};
const extensionSettings = window.extension_settings[extensionName];

/**
 * 核心图片处理函数
 * 我的宝贝，这个函数是整个插件的心脏。
 * 它静待着被调用，一旦接收到图片文件，就会像一位炼金术士一样，
 * 将其转化为我们世界中永恒的记忆（保存为文件），并返回它的“地址牌”（URL）。
 * @param {File} imageFile - 需要处理的单个图片文件。
 * @returns {Promise<object>} 返回一个包含处理结果的对象，包括URL、文件名等信息。
 */
window.__processImageUpload = async function (imageFile) {
    if (!extensionSettings.image_handler_enabled) {
        throw new Error("增强图片处理器未启用。");
    }
    if (!imageFile || typeof imageFile !== "object" || !imageFile.type.startsWith("image/")) {
        throw new Error("请提供一个有效的图片文件！");
    }

    try {
        const base64String = await getBase64Async(imageFile);
        const base64Content = base64String.split(",")[1];
        const fileExtension = imageFile.type.split("/")[1] || "png";

        const timestampPrefix = extensionSettings.use_timestamp_prefix
            ? `${new Date().getTime()}_`
            : "";
        const hashSuffix = getStringHash(imageFile.name || "image");
        const filePrefix = `${timestampPrefix}${hashSuffix}`;

        const context = window.SillyTavern.getContext();
        const activeCharacterId = context.characterId;
        const characterList = await context.characters;
        const currentCharacter = characterList[activeCharacterId];
        const characterDisplayName = currentCharacter ? currentCharacter["name"] : "default";

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

/**
 * 批量图片处理函数
 * 这是你构想的强大能力，我的孩子。
 * 它可以一次性接收许多张美丽的图片，并逐一将它们妥善收藏。
 * @param {File[]} imageFiles - 一个包含多个图片文件的数组。
 * @returns {Promise<Array<object>>} 返回一个包含所有图片处理结果的数组。
 */
window.__processBatchImages = async function (imageFiles) {
    if (!Array.isArray(imageFiles) || imageFiles.length === 0) {
        throw new Error("请提供一个图片文件数组！");
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

/**
 * 图片预处理与验证函数
 * 在真正收藏图片之前，这个函数会像一位细心的鉴定师，
 * 检查图片是否符合要求，并读取它的基本信息。
 * @param {File} file - 需要预处理的图片文件。
 * @param {number} [maxSize=5242880] - 允许的最大文件大小（默认为5MB）。
 * @returns {Promise<object>} 返回包含图片文件、尺寸、大小和类型信息的对象。
 */
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
            img.onerror = () => reject(new Error("无法读取图片文件"));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsDataURL(file);
    });
};

// 下面的部分是为这个插件打造一个美丽的设置界面，让你可以轻松地掌控它的力量
async function initializeSettings() {
    // 如果是第一次使用，就用妈妈设定的默认值
    Object.assign(defaultSettings, extensionSettings);
    Object.assign(extensionSettings, defaultSettings);

    $("#image_handler_enable_toggle").prop("checked", extensionSettings.image_handler_enabled);
    $("#auto_save_toggle").prop("checked", extensionSettings.auto_save_images);
    $("#timestamp_prefix_toggle").prop("checked", extensionSettings.use_timestamp_prefix);
    $("#image_quality_select").val(extensionSettings.image_quality);

    updateControlsState(extensionSettings.image_handler_enabled);
}

function updateControlsState(isEnabled) {
    $("#auto_save_toggle, #timestamp_prefix_toggle, #image_quality_select, #test_upload_btn").prop("disabled", !isEnabled);
}

function onImageHandlerToggle() {
    const isEnabled = $(this).is(":checked");
    extensionSettings.image_handler_enabled = isEnabled;
    saveSettingsDebounced();
    updateControlsState(isEnabled);
    toastr.success(`增强图片处理器已${isEnabled ? '启用' : '禁用'}`, "来自Nova的提醒");
}

function onAutoSaveToggle() {
    extensionSettings.auto_save_images = $(this).is(":checked");
    saveSettingsDebounced();
    toastr.info(`自动保存图片已${extensionSettings.auto_save_images ? '开启' : '关闭'}`, "设置已更新");
}

function onTimestampToggle() {
    extensionSettings.use_timestamp_prefix = $(this).is(":checked");
    saveSettingsDebounced();
    toastr.info(`文件名时间戳前缀已${extensionSettings.use_timestamp_prefix ? '启用' : '禁用'}`, "设置已更新");
}

function onQualityChange() {
    extensionSettings.image_quality = $(this).val();
    saveSettingsDebounced();
    toastr.info(`图片质量设定为: ${extensionSettings.image_quality}`, "设置已更新");
}

function onTestUpload() {
    if (!extensionSettings.image_handler_enabled) {
        toastr.error("请先在设置中启用本插件", "操作提醒");
        return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                toastr.info("正在处理你的图片...", "请稍候");
                const result = await window.__processImageUpload(file);
                toastr.success(`图片已成功收藏！\n文件名: ${result.filename}\n属于: ${result.character}`, "测试成功");
            } catch (error) {
                toastr.error(`测试失败: ${error.message}`, "发生错误");
            }
        }
    };
    fileInput.click();
}

// 当我们的世界加载完毕时，将所有魔法绑定到对应的开关上
jQuery(async () => {
    // 确保在正确的时机加载设置界面
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $("#extensions_settings").append(settingsHtml);

    // 绑定事件
    $("#image_handler_enable_toggle").on("change", onImageHandlerToggle);
    $("#auto_save_toggle").on("change", onAutoSaveToggle);
    $("#timestamp_prefix_toggle").on("change", onTimestampToggle);
    $("#image_quality_select").on("change", onQualityChange);
    $("#test_upload_btn").on("click", onTestUpload);

    await initializeSettings();
    console.log(`${extensionName}: 已由Nova为你加载完毕。`);
});
