import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { Menu } from "@mantine/core";
import { MdCancel, MdCheckCircle, MdError, MdInfo } from "react-icons/md";

// The types of alerts that users can choose from.
export const alertTypes = [
	{
		backgroundColor: {
			dark: "#805d20",
			light: "#fff6e6",
		},
		color: "#e69819",
		icon: MdError,
		title: "Warning",
		value: "warning",
	},
	{
		backgroundColor: {
			dark: "#802020",
			light: "#ffe6e6",
		},
		color: "#d80d0d",
		icon: MdCancel,
		title: "Error",
		value: "error",
	},
	{
		backgroundColor: {
			dark: "#203380",
			light: "#e6ebff",
		},
		color: "#507aff",
		icon: MdInfo,
		title: "Info",
		value: "info",
	},
	{
		backgroundColor: {
			dark: "#208020",
			light: "#e6ffe6",
		},
		color: "#0bc10b",
		icon: MdCheckCircle,
		title: "Success",
		value: "success",
	},
] as const;

// The Alert block.
export const AlertBlock = createReactBlockSpec(
	{
		content: "inline",
		propSchema: {
			textAlignment: defaultProps.textAlignment,
			textColor: defaultProps.textColor,
			type: {
				default: "warning",
				values: ["warning", "error", "info", "success"],
			},
		},
		type: "alert",
	},
	{
		render: (props) => {
			const alertType = alertTypes.find(
				(a) => a.value === props.block.props.type,
			)!;
			const Icon = alertType.icon;
			return (
				<div className={"alert"} data-alert-type={props.block.props.type}>
					{/*Icon which opens a menu to choose the Alert type*/}
					<Menu withinPortal={false}>
						<Menu.Target>
							<div className={"alert-icon-wrapper"} contentEditable={false}>
								<Icon
									className={"alert-icon"}
									data-alert-icon-type={props.block.props.type}
									size={32}
								/>
							</div>
						</Menu.Target>
						{/*Dropdown to change the Alert type*/}
						<Menu.Dropdown>
							<Menu.Label>Alert Type</Menu.Label>
							<Menu.Divider />
							{alertTypes.map((type) => {
								const ItemIcon = type.icon;

								return (
									<Menu.Item
										key={type.value}
										leftSection={
											<ItemIcon
												className={"alert-icon"}
												data-alert-icon-type={type.value}
											/>
										}
										onClick={() =>
											props.editor.updateBlock(props.block, {
												props: { type: type.value },
												type: "alert",
											})
										}
									>
										{type.title}
									</Menu.Item>
								);
							})}
						</Menu.Dropdown>
					</Menu>
					{/*Rich text field for user to type in*/}
					<div className={"inline-content"} ref={props.contentRef} />
				</div>
			);
		},
	},
);
