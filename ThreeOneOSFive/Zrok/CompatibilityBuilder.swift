import Foundation

enum CompatibilityBuilder {
    static func defaultEntries() -> [CompatibilityEntry] {
        [
            CompatibilityEntry(
                version: "iOS 18.0 – 18.7.1",
                status: .supported,
                note: "Compatibilidade padrão"
            )
        ]
    }
}
