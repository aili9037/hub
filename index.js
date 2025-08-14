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

// 插件配置
const PLUGIN_CONFIG = {
    name: "图片工具",
    id: "图片工具",
    defaultSettings: {
        plugin_enabled: true,
        auto_save: true
    }
};

// 初始化扩展设置
window.extension_settings = window.extension_settings || {};
window.extension_settings[PLUGIN_CONFIG.id] = window.extension_settings[PLUGIN_CONFIG.id] || {};
const pluginSettings = window.extension_settings[PLUGIN_CONFIG.id];

// 核心图片上传功能
async function processImageUpload(imageFile) {
    // 验证文件类型
    if (!imageFile || !imageFile.type || !imageFile.type.startsWith("image/")) {
        throw new Error("请选择有效的图片文件！");
    }

    try {
        // 转换为base64
        const base64String = await getBase64Async(imageFile);
        const base64Content = base64String.split(",")[1];

        // 获取文件扩展名
        const fileExtension = imageFile.type.split("/")[1] || "png";

        // 生成唯一文件名
        const timestamp = Date.now();
        const hashValue = getStringHash(imageFile.name);
        const uniqueFileName = `${timestamp}_${hashValue}`;

        // 获取当前角色信息
        const context = window.SillyTavern.getContext();
        const currentChar = context.characterId;
        const characterList = await context.characters;
        const activeCharacter = characterList[currentChar];
        const characterName = activeCharacter["name"];

        // 保存文件并获取URL
        const imageURL = await saveBase64AsFile(
            base64Content,
            characterName,
            uniqueFileName,
            fileExtension
        );

        return { url: imageURL };
    } catch (error) {
        console.error("图片处理失败:", error);
        throw error;
    }
}

// 新增：支持微信聊天界面的图片上传功能
async function processWechatImageUpload(imageFile) {
    // 验证文件类型
    if (!imageFile || !imageFile.type || !imageFile.type.startsWith("image/")) {
        throw new Error("请选择有效的图片文件！");
    }

    try {
        // 转换为base64
        const base64String = await getBase64Async(imageFile);
        const base64Content = base64String.split(",")[1];

        // 获取文件扩展名
        const fileExtension = imageFile.type.split("/")[1] || "png";

        // 生成唯一文件名
        const timestamp = Date.now();
        const hashValue = getStringHash(imageFile.name);
        const uniqueFileName = `${timestamp}_${hashValue}`;

        // 获取当前角色信息
        const context = window.SillyTavern.getContext();
        const currentChar = context.characterId;
        const characterList = await context.characters;
        const activeCharacter = characterList[currentChar];
        const characterName = activeCharacter["name"];

        // 保存文件并获取URL - 这里会自动创建 user/images/角色名/ 文件夹
        const imageURL = await saveBase64AsFile(
            base64Content,
            characterName,
            uniqueFileName,
            fileExtension
        );

        return { url: imageURL };
    } catch (error) {
        console.error("微信图片处理失败:", error);
        throw error;
    }
}

// 将功能暴露到全局
window.__uploadImageByPlugin = processImageUpload;
window.__uploadWechatImageByPlugin = processWechatImageUpload;

// 设置加载函数
async function initializeSettings() {
    // 合并默认设置
    extension_settings[PLUGIN_CONFIG.id] = extension_settings[PLUGIN_CONFIG.id] || {};
    if (Object.keys(extension_settings[PLUGIN_CONFIG.id]).length === 0) {
        Object.assign(extension_settings[PLUGIN_CONFIG.id], PLUGIN_CONFIG.defaultSettings);
    }

    // 更新UI状态
    const enableSwitch = $("#plugin_enable_switch");
    const testButton = $("#my_button");
    const settingCheckbox = $("#example_setting");

    if (enableSwitch.length) {
        enableSwitch.prop("checked", extension_settings[PLUGIN_CONFIG.id].plugin_enabled);
    }

    if (testButton.length) {
        testButton.prop("disabled", !extension_settings[PLUGIN_CONFIG.id].plugin_enabled);
    }

    if (settingCheckbox.length) {
        settingCheckbox.prop("disabled", !extension_settings[PLUGIN_CONFIG.id].plugin_enabled);
        settingCheckbox.prop("checked", extension_settings[PLUGIN_CONFIG.id].example_setting);
    }
}

// 事件处理函数
function handleSettingChange(event) {
    const isChecked = Boolean($(event.target).prop("checked"));
    extension_settings[PLUGIN_CONFIG.id].example_setting = isChecked;
    saveSettingsDebounced();
}

function handleTestButtonClick() {
    const isEnabled = extension_settings[PLUGIN_CONFIG.id].example_setting;
    toastr.info(
        `设置状态: ${isEnabled ? "已启用" : "已禁用"}`,
        "测试按钮被点击了！"
    );
}

let switchInitialized = false;

function handlePluginToggle(event) {
    const isEnabled = Boolean($(event.target).prop("checked"));
    extension_settings[PLUGIN_CONFIG.id].plugin_enabled = isEnabled;

    if (saveSettingsDebounced) {
        saveSettingsDebounced();
    }

    // 更新相关UI状态
    $("#my_button").prop("disabled", !isEnabled);
    $("#example_setting").prop("disabled", !isEnabled);

    // 显示状态提示
    if (switchInitialized) {
        if (isEnabled) {
            toastr.success("图片工具已启用", "提示");
        } else {
            toastr.warning("图片工具已禁用", "提示");
        }
    }
    switchInitialized = true;
}

// jQuery初始化
jQuery(async () => {
    // 绑定事件监听器
    $("#plugin_enable_switch").on("input", handlePluginToggle);
    $("#my_button").on("click", handleTestButtonClick);
    $("#example_setting").on("input", handleSettingChange);

    // 加载设置
    await initializeSettings();
});
