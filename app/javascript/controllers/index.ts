import { Application } from "@hotwired/stimulus"

import ThemeController from "./theme_controller"
import DropdownController from "./dropdown_controller"
import SdkIntegrationController from "./sdk_integration_controller"
import ClipboardController from "./clipboard_controller"
import TomSelectController from "./tom_select_controller"
import FlatpickrController from "./flatpickr_controller"
import SystemMonitorController from "./system_monitor_controller"
import FlashController from "./flash_controller"
import ArticlesController from "./articles_controller"
import VoiceRecorderController from "./voice_recorder_controller"
import BookReaderController from "./book_reader_controller"
import BookChaptersController from "./book_chapters_controller"
import MarkdownRendererController from "./markdown_renderer_controller"
import WritingTipController from "./writing_tip_controller"

const application = Application.start()

application.register("theme", ThemeController)
application.register("dropdown", DropdownController)
application.register("sdk-integration", SdkIntegrationController)
application.register("clipboard", ClipboardController)
application.register("tom-select", TomSelectController)
application.register("flatpickr", FlatpickrController)
application.register("system-monitor", SystemMonitorController)
application.register("flash", FlashController)
application.register("articles", ArticlesController)
application.register("voice-recorder", VoiceRecorderController)
application.register("book-reader", BookReaderController)
application.register("book-chapters", BookChaptersController)
application.register("markdown-renderer", MarkdownRendererController)
application.register("writing-tip", WritingTipController)

window.Stimulus = application
