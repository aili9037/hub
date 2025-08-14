import {
    getBase64Async,
    getStringHash,
    saveBase64AsFile,
} from "../../../utils.js";

import {
    extension_settings,
    getContext,
} from "../../../extensions.js";

import { saveSettingsDebounced } from "../../../../script.js";

(function () {
    const extensionName = "Enhanced-Image-Handler";
    const defaultSettings = {
        image_handler_enabled: true,
        auto_save_images: true,
        use_timestamp_prefix: true,
        image_quality: "original"
    };

    // 确保扩展设置对象存在
    window.extension_settings = window.extension_settings || {};
    window.extension_settings[extensionName] = window.extension_settings[extensionName] || {};
    const extensionSettings = window.extension_settings[extensionName];

    // 核心图片处理函数
    window.__processImageUpload = async function (imageFile) {
        if (!extensionSettings.image_handler_enabled) {
            console.log(`${extensionName} is disabled. Skipping image processing.`);
            // 如果插件被禁用，可以考虑返回一个特定的状态或直接抛出错误
            throw new Error("Enhanced Image Handler is disabled.");
        }

        if (!imageFile || typeof imageFile !== "object" || !imageFile.type.startsWith("image/")) {
            throw new Error("Please provide a valid image file.");
        }

        try {
            const base64String = await getBase64Async(imageFile);
            const base64Content = base64String.split(",")[1];
            const fileExtension = imageFile.type.split("/")[1] || "png";

            const timestampPrefix = extensionSettings.use_timestamp_prefix ? `${new Date().getTime()}_` : "";
            const hashSuffix = getStringHash(imageFile.name || "image");
            const filePrefix = `${timestampPrefix}${hashSuffix}`;

            const context = getContext();
            const activeCharacterId = context.characterId;
            // SillyTavern 1.11.3+ context.characters is a promise
            const characterList = await context.characters;
            const currentCharacter = characterList.find(c => c.avatar === activeCharacterId);
            const characterDisplayName = currentCharacter ? currentCharacter.name : "default";

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
            console.error(`${extensionName}: Image processing failed`, error);
            throw new Error(`Image processing failed: ${error.message}`);
        }
    };

    // 批量图片处理函数
    window.__processBatchImages = async function (imageFiles) {
        if (!Array.isArray(imageFiles) || imageFiles.length === 0) {
            throw new Error("Please provide an array of image files.");
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

    // 图片预处理函数
    window.__preprocessImage = function (file, maxSize = 5 * 1024 * 1024) {
        return new Promise((resolve, reject) => {
            if (file.size > maxSize) {
                reject(new Error(`Image file is too large. Maximum size is ${maxSize / 1024 / 1024}MB.`));
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
                    reject(new Error("Could not read the image file."));
                };
                img.src = e.target.result;
            };
            reader.onerror = function() {
                reject(new Error("File reading failed."));
            };
            reader.readAsDataURL(file);
        });
    };

    async function initializeSettings() {
        // 合并默认设置
        Object.assign(extensionSettings, { ...defaultSettings, ...extensionSettings });

        // 等待DOM加载完成
        await new Promise(resolve => $(document).ready(resolve));

        // 更新UI控件状态
        $("#image_handler_enable_toggle").prop("checked", extensionSettings.image_handler_enabled);
        $("#auto_save_toggle").prop("checked", extensionSettings.auto_save_images);
        $("#timestamp_prefix_toggle").prop("checked", extensionSettings.use_timestamp_prefix);
        $("#image_quality_select").val(extensionSettings.image_quality);

        updateControlsState();
    }

    function updateControlsState() {
        const isEnabled = extensionSettings.image_handler_enabled;
        $("#auto_save_toggle, #timestamp_prefix_toggle, #image_quality_select, #test_upload_btn").prop("disabled", !isEnabled);
    }

    function onImageHandlerToggle(event) {
        extensionSettings.image_handler_enabled = Boolean($(event.target).prop("checked"));
        saveSettingsDebounced();
        updateControlsState();
        toastr.info(`Enhanced Image Handler has been ${extensionSettings.image_handler_enabled ? 'enabled' : 'disabled'}.`, "Settings Updated");
    }

    function onAutoSaveToggle(event) {
        extensionSettings.auto_save_images = Boolean($(event.target).prop("checked"));
        saveSettingsDebounced();
        toastr.info(`Auto-save is now ${extensionSettings.auto_save_images ? 'on' : 'off'}.`, "Settings Updated");
    }

    function onTimestampToggle(event) {
        extensionSettings.use_timestamp_prefix = Boolean($(event.target).prop("checked"));
        saveSettingsDebounced();
        toastr.info(`Timestamp prefix is now ${extensionSettings.use_timestamp_prefix ? 'enabled' : 'disabled'}.`, "Settings Updated");
    }

    function onQualityChange(event) {
        extensionSettings.image_quality = $(event.target).val();
        saveSettingsDebounced();
        toastr.info(`Image quality set to: ${extensionSettings.image_quality}`, "Settings Updated");
    }

    function onTestUpload() {
        if (!extensionSettings.image_handler_enabled) {
            toastr.error("Please enable the image handler first.", "Test Failed");
            return;
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = async function(e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    toastr.info("Processing image...", "Test Upload");
                    const result = await window.__processImageUpload(file);
                    toastr.success(
                        `Image uploaded successfully!\nFile: ${result.filename}\nCharacter: ${result.character}`,
                        "Test Succeeded"
                    );
                } catch (error) {
                    toastr.error(`Test failed: ${error.message}`, "Upload Error");
                }
            }
        };
        fileInput.click();
    }

    // 初始化插件
    jQuery(async () => {
        // 等待SillyTavern的核心脚本加载完成
        await initializeSettings();

        // 动态绑定事件，以防UI元素延迟加载
        $(document).on("input", "#image_handler_enable_toggle", onImageHandlerToggle);
        $(document).on("input", "#auto_save_toggle", onAutoSaveToggle);
        $(document).on("input", "#timestamp_prefix_toggle", onTimestampToggle);
        $(document).on("change", "#image_quality_select", onQualityChange);
        $(document).on("click", "#test_upload_btn", onTestUpload);

        console.log(`${extensionName} v1.0.0 has been successfully loaded.`);
    });

})();
