import { ref, computed, type Ref } from 'vue';
import { load } from '@tauri-apps/plugin-store';

export type Locale = 'en' | 'vi';

// Full bilingual dictionary
const messages: Record<string, { en: string; vi: string }> = {
  // --- App shell ---
  'app.empty.noWorkspace': { en: 'Add a folder to begin.', vi: 'Thêm thư mục để bắt đầu.' },
  'app.empty.selectFile': { en: 'Select a .md file from the sidebar, or press {key}+P.', vi: 'Chọn file .md từ sidebar, hoặc nhấn {key}+P.' },

  // --- Explorer ---
  'explorer.title': { en: 'File Explorer', vi: 'File Explorer' },
  'explorer.outline': { en: 'Outline (TOC)', vi: 'Mục lục (TOC)' },
  'explorer.addFolder': { en: 'Add Folder', vi: 'Thêm thư mục' },
  'explorer.addFolderOrWs': { en: 'Add folder or .code-workspace', vi: 'Thêm thư mục hoặc .code-workspace' },
  'explorer.openWorkspace': { en: 'Open Workspace…', vi: 'Mở Workspace…' },
  'explorer.addFolderToWs': { en: 'Add Folder to Workspace', vi: 'Thêm thư mục vào Workspace' },
  'explorer.saveWs': { en: 'Save as Workspace…', vi: 'Lưu thành Workspace…' },
  'explorer.closeWs': { en: 'Close workspace', vi: 'Đóng workspace' },
  'explorer.refresh': { en: 'Refresh Explorer', vi: 'Làm mới Explorer' },
  'explorer.newFile': { en: 'New file in this root', vi: 'Tạo file mới' },
  'explorer.newFolder': { en: 'New folder in this root', vi: 'Tạo thư mục mới' },
  'explorer.noFolder': { en: 'No folder opened.', vi: 'Chưa mở thư mục nào.' },
  'explorer.loading': { en: 'Loading…', vi: 'Đang tải…' },
  'explorer.noMdFiles': { en: 'No .md files found.', vi: 'Không tìm thấy file .md.' },
  'explorer.recent': { en: 'Recent', vi: 'Gần đây' },

  // --- Context menu ---
  'ctx.newFile': { en: 'New File', vi: 'Tạo file mới' },
  'ctx.newFolder': { en: 'New Folder', vi: 'Tạo thư mục mới' },
  'ctx.rename': { en: 'Rename', vi: 'Đổi tên' },
  'ctx.delete': { en: 'Delete', vi: 'Xóa' },
  'ctx.copy': { en: 'Copy', vi: 'Sao chép' },
  'ctx.cut': { en: 'Cut', vi: 'Cắt' },
  'ctx.paste': { en: 'Paste', vi: 'Dán' },
  'ctx.pasteHere': { en: 'Paste here', vi: 'Dán vào đây' },
  'ctx.removeRoot': { en: 'Remove Folder from Workspace', vi: 'Xóa thư mục khỏi Workspace' },
  'ctx.openTerminalHere': { en: 'Open Terminal Here', vi: 'Mở Terminal tại đây' },

  // --- Tabs ---
  'tab.close': { en: 'Close', vi: 'Đóng' },
  'tab.closeAll': { en: 'Close All Tabs', vi: 'Đóng tất cả tab' },
  'tab.closeTooltip': { en: 'Close (Cmd/Ctrl+W)', vi: 'Đóng (Cmd/Ctrl+W)' },
  'tab.newTerminal': { en: 'New Terminal', vi: 'Terminal mới' },
  'tab.closePanel': { en: 'Close panel', vi: 'Đóng panel' },

  // --- Editor toolbar ---
  'toolbar.bold': { en: 'Bold (Cmd/Ctrl+B)', vi: 'In đậm (Cmd/Ctrl+B)' },
  'toolbar.italic': { en: 'Italic (Cmd/Ctrl+I)', vi: 'In nghiêng (Cmd/Ctrl+I)' },
  'toolbar.heading': { en: 'Heading (cycle H1-H3)', vi: 'Heading (H1→H2→H3)' },
  'toolbar.underline': { en: 'Underline', vi: 'Gạch chân' },
  'toolbar.strikethrough': { en: 'Strikethrough', vi: 'Gạch ngang' },
  'toolbar.orderedList': { en: 'Ordered list', vi: 'Danh sách có thứ tự' },
  'toolbar.unorderedList': { en: 'Unordered list', vi: 'Danh sách không thứ tự' },
  'toolbar.checklist': { en: 'Checklist', vi: 'Checklist' },
  'toolbar.quote': { en: 'Quote', vi: 'Trích dẫn' },
  'toolbar.codeBlock': { en: 'Code block', vi: 'Khối code' },
  'toolbar.table': { en: 'Table', vi: 'Bảng' },
  'toolbar.link': { en: 'Link', vi: 'Liên kết' },
  'toolbar.image': { en: 'Image', vi: 'Hình ảnh' },
  'toolbar.wordWrap': { en: 'Toggle Word Wrap', vi: 'Toggle Word Wrap' },
  'toolbar.openBrowser': { en: 'Open preview in browser', vi: 'Mở preview trong trình duyệt' },

  // --- Preview ---
  'preview.print': { en: 'Print / Export PDF', vi: 'In / Xuất PDF' },
  'preview.light': { en: 'Switch preview to light', vi: 'Preview sáng' },
  'preview.dark': { en: 'Switch preview to dark', vi: 'Preview tối' },
  'preview.empty': { en: 'Preview will appear here.', vi: 'Preview sẽ hiển thị ở đây.' },
  'preview.loading': { en: 'Loading {name}…', vi: 'Đang tải {name}…' },

  // --- Theme ---
  'theme.light': { en: 'Switch to light theme', vi: 'Giao diện sáng' },
  'theme.dark': { en: 'Switch to dark theme', vi: 'Giao diện tối' },

  // --- Terminal ---
  'terminal.toggle': { en: 'Toggle Terminal (Cmd/Ctrl+`)', vi: 'Terminal (Cmd/Ctrl+`)' },

  // --- Sidebar ---
  'sidebar.collapse': { en: 'Collapse Sidebar (Cmd/Ctrl+B)', vi: 'Thu gọn Sidebar (Cmd/Ctrl+B)' },

  // --- Settings ---
  'settings.title': { en: 'Settings', vi: 'Cài đặt' },
  'settings.about': { en: 'About', vi: 'Thông tin' },
  'settings.updates': { en: 'Updates', vi: 'Cập nhật' },
  'settings.version': { en: 'Version', vi: 'Phiên bản' },
  'settings.author': { en: 'Author', vi: 'Tác giả' },
  'settings.license': { en: 'License', vi: 'Giấy phép' },
  'settings.github': { en: 'GitHub', vi: 'GitHub' },
  'settings.close': { en: 'Close', vi: 'Đóng' },
  'settings.language': { en: 'Language', vi: 'Ngôn ngữ' },
  'settings.langEn': { en: 'English', vi: 'Tiếng Anh' },
  'settings.langVi': { en: 'Tiếng Việt', vi: 'Tiếng Việt' },
  'settings.checkUpdate': { en: 'Check for Updates', vi: 'Kiểm tra cập nhật' },
  'settings.checkNow': { en: 'Check now', vi: 'Kiểm tra ngay' },
  'settings.checking': { en: 'Checking for updates…', vi: 'Đang kiểm tra cập nhật…' },
  'settings.latest': { en: "You're on the latest version.", vi: 'Bạn đang dùng phiên bản mới nhất.' },
  'settings.available': { en: '{version} is available.', vi: '{version} đã có sẵn.' },
  'settings.downloading': { en: 'Downloading… {percent}%', vi: 'Đang tải… {percent}%' },
  'settings.ready': { en: 'Update downloaded — installing.', vi: 'Đã tải xong — đang cài đặt.' },
  'settings.error': { en: 'Update check failed.', vi: 'Kiểm tra cập nhật thất bại.' },
  'settings.autoCheck': { en: 'mdview checks automatically on startup.', vi: 'mdview tự động kiểm tra khi khởi động.' },

  // --- Update modal ---
  'update.title': { en: '{name} {version} available', vi: '{name} {version} đã có sẵn' },
  'update.current': { en: 'current: {version}', vi: 'hiện tại: {version}' },
  'update.downloading': { en: 'Downloading… {percent}% ({downloaded} / {total})', vi: 'Đang tải… {percent}% ({downloaded} / {total})' },
  'update.complete': { en: 'Download complete', vi: 'Tải xong' },
  'update.failed': { en: 'Update failed', vi: 'Cập nhật thất bại' },
  'update.releaseNotes': { en: 'Release notes', vi: 'Ghi chú phiên bản' },
  'update.later': { en: 'Later', vi: 'Để sau' },
  'update.install': { en: 'Install & Restart', vi: 'Cài đặt & Khởi động lại' },
  'update.goDownload': { en: 'Go to Download Page', vi: 'Đến trang tải xuống' },
  'update.tryAgain': { en: 'Try again', vi: 'Thử lại' },
  'update.close': { en: 'Close', vi: 'Đóng' },

  // --- Command palette ---
  'palette.placeholder': { en: 'Search files by name…', vi: 'Tìm file theo tên…' },
  'palette.noMatches': { en: 'No matches.', vi: 'Không tìm thấy.' },

  // --- Input placeholders ---
  'input.filename': { en: 'filename.md', vi: 'ten-file.md' },
  'input.foldername': { en: 'folder-name', vi: 'ten-thu-muc' },
  'input.rename': { en: 'new name', vi: 'tên mới' },

  // --- Confirm dialogs ---
  'confirm.deleteTitle': { en: 'Delete file', vi: 'Xóa file' },
  'confirm.deleteMsg': { en: 'Delete "{name}"? This cannot be undone.', vi: 'Xóa "{name}"? Hành động này không thể hoàn tác.' },
  'confirm.unsavedTitle': { en: 'Unsaved changes', vi: 'Chưa lưu thay đổi' },
  'confirm.unsavedMsg': { en: '"{name}" has unsaved changes. Close without saving?', vi: '"{name}" có thay đổi chưa lưu. Đóng mà không lưu?' },
  'confirm.closeAllTitle': { en: 'Close all tabs', vi: 'Đóng tất cả tab' },
  'confirm.closeAllMsg': { en: '{n} file(s) have unsaved changes. Close all without saving?', vi: '{n} file có thay đổi chưa lưu. Đóng tất cả?' },

  // --- Error messages ---
  'error.folderNotFound': { en: 'folder not found', vi: 'không tìm thấy thư mục' },
  'error.wsFileNotFound': { en: 'Workspace file not found: {path}', vi: 'Không tìm thấy file workspace: {path}' },
  'error.wsFolderNotFound': { en: 'Workspace folder not found: {path}', vi: 'Không tìm thấy thư mục workspace: {path}' },
  'error.emptyFolderName': { en: 'empty folder name', vi: 'tên thư mục trống' },
  'error.folderNameSlash': { en: 'folder name cannot contain path separators', vi: 'tên thư mục không được chứa dấu phân cách đường dẫn' },

  // --- Tour ---
  'tour.skip': { en: 'Skip tour', vi: 'Bỏ qua' },
  'tour.next': { en: 'Next', vi: 'Tiếp' },
  'tour.back': { en: 'Back', vi: 'Quay lại' },
  'tour.finish': { en: 'Finish', vi: 'Hoàn tất' },

  // --- Search and Daily Notes ---
  'search.title': { en: 'Search', vi: 'Tìm kiếm' },
  'search.placeholder': { en: 'Search in workspace…', vi: 'Tìm trong workspace…' },
  'search.noResults': { en: 'No results found.', vi: 'Không tìm thấy kết quả.' },
  'search.loading': { en: 'Searching…', vi: 'Đang tìm kiếm…' },
  'search.resultsCount': { en: 'Found {count} match(es) in {filesCount} file(s)', vi: 'Tìm thấy {count} kết quả trong {filesCount} file' },
  'settings.dailyNotesFolder': { en: 'Daily Notes Folder Path', vi: 'Đưòng dẫn Thư mục Daily Notes' },
  'settings.dailyNotesFolderDesc': { en: 'Leave empty for first workspace root directory', vi: 'Để trống để tạo tại thư mục root đầu tiên của Workspace' },
  'settings.dailyNotesHeader': { en: 'Daily Notes & Journaling', vi: 'Nhật ký Hàng ngày' },
};

const currentLocale: Ref<Locale> = ref('en');

function t(key: string, params?: Record<string, string | number>): string {
  const msg = messages[key];
  if (!msg) return key;
  let text = msg[currentLocale.value] ?? msg.en;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

function setLocale(locale: Locale) {
  currentLocale.value = locale;
}

async function initLocale(): Promise<void> {
  try {
    const store = await load('mdview-settings.json', { autoSave: true, defaults: {} });
    const v = await store.get<Locale>('locale');
    if (v === 'en' || v === 'vi') {
      currentLocale.value = v;
    }
  } catch {
    // Keep default 'en'
  }
}

async function persistLocale(locale: Locale): Promise<void> {
  currentLocale.value = locale;
  try {
    const store = await load('mdview-settings.json', { autoSave: true, defaults: {} });
    await store.set('locale', locale);
    await store.save();
  } catch (e) {
    console.error('persistLocale failed', e);
  }
}

export function useI18n() {
  return { t, currentLocale: computed(() => currentLocale.value), setLocale, initLocale, persistLocale };
}
