import re

# File definitions
files = [
    ("ActivationView.swift", "3105S001", "3105S002"),
    ("FeatureRepository.swift", "3105S003", "3105S004"),
    ("InfoView.swift", "3105S005", "3105S006"),
    ("SwagDesign.swift", "3105S007", "3105S008"),
    ("SwagFeature.swift", "3105S009", "3105S010"),
    ("SwagFeatureManager.swift", "3105S011", "3105S012"),
    ("SwagFeatureRow.swift", "3105S013", "3105S014"),
    ("SwagFeatureSection.swift", "3105S015", "3105S016"),
    ("SwagGameHeader.swift", "3105S017", "3105S018"),
    ("SwagModels.swift", "3105S019", "3105S020"),
]
swag_group_uuid = "3105S021"

with open("ThreeOneOSFive.xcodeproj/project.pbxproj", "r") as f:
    content = f.read()

# Check for duplicates to ensure idempotency
for _, fr, _ in files:
    if fr in content:
        print(f"Error: {fr} already exists. Aborting.")
        exit(1)

# 1. Add PBXFileReference
file_refs = ""
for name, fr, _ in files:
    file_refs += f"\t\t{fr} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {name}; sourceTree = \"<group>\"; }};\n"
content = content.replace("/* End PBXFileReference section */", f"{file_refs}\t/* End PBXFileReference section */")

# 2. Add PBXBuildFile
build_files = ""
for name, fr, bf in files:
    build_files += f"\t\t{bf} /* {name} in Sources */ = {{isa = PBXBuildFile; fileRef = {fr}; }};\n"
content = content.replace("/* End PBXBuildFile section */", f"{build_files}\t/* End PBXBuildFile section */")

# 3. Add PBXGroup for Swag
swag_group = f"\t\t{swag_group_uuid} /* Swag */ = {{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n"
for name, fr, _ in files:
    swag_group += f"\t\t\t\t{fr} /* {name} */,\n"
swag_group += "\t\t\t);\n\t\t\tpath = Swag;\n\t\t\tsourceTree = \"<group>\";\n\t\t};\n"
content = content.replace("/* End PBXGroup section */", f"{swag_group}\t/* End PBXGroup section */")

# 4. Add Swag to main group children (3105A401)
content = re.sub(r"(3105A401 /\* ThreeOneOSFive \*/ = \{[\s\S]+?children = \([\s\S]+?)(\);)", rf"\1\t\t\t\t{swag_group_uuid} /* Swag */,\n\2", content)

# 5. Add BuildFiles to SourcesBuildPhase (3105A700)
build_files_list = ", ".join([bf for _, _, bf in files])
content = re.sub(r"(3105A700 /\* Sources \*/ = \{[\s\S]+?files = \([\s\S]+?)(\);)", rf"\1\t\t\t\t{build_files_list},\n\2", content)

with open("ThreeOneOSFive.xcodeproj/project.pbxproj", "w") as f:
    f.write(content)
print("Changes applied.")
